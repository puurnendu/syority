import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { scheduleRecalculateQueue } from '@/lib/queues';
import type { ActivityStatus } from '@prisma/client';

/**
 * Enqueues a CPM recalculation for the project that owns `workpackId`.
 * Uses jobId deduplication so rapid saves (create/update/delete burst) collapse
 * into a single queue entry — preventing redundant DB-heavy passes.
 */
async function enqueueRecalculate(workpackId: string | null | undefined, orgId: string) {
  if (!workpackId) return;

  const workpack = await prisma.workpack.findUnique({
    where: { id: workpackId },
    select: { project_id: true },
  });

  if (!workpack?.project_id) return; // activity not tied to a project — skip

  await scheduleRecalculateQueue.add(
    'recalculate',
    { projectId: workpack.project_id, orgId },
    {
      // Deduplication: only one recalc job per project in the queue at a time
      jobId: `recalc-${workpack.project_id}`,
      removeOnComplete: 100,
    }
  );
}

export class ActivityService {
    static async createActivity(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        description: string;
        created_by: string;
        duration_hours?: number;
        discipline_id?: string;
        work_category?: string;
        notes?: string;
        activity_number?: string;
    }) {
        const lastSeq = await prisma.activity.aggregate({
            where: { workpack_id: data.workpack_id, deleted_at: null },
            _max: { sequence_number: true },
        });
        const seq = (lastSeq._max.sequence_number ?? 0) + 1;
        const created = await prisma.activity.create({ data: { ...data, sequence_number: seq, status: 'not_started' } });

        // V5: Auto-load default resources from library
        if ((data as any).activity_library_id) {
            const defaults = await prisma.activityCodeDefaultResource.findMany({
                where: { library_id: (data as any).activity_library_id }
            });
            if (defaults.length > 0) {
                await prisma.activityResource.createMany({
                    data: defaults.map(d => ({
                        organization_id: data.organization_id,
                        workpack_id: data.workpack_id,
                        activity_id: created.id,
                        resource_id: d.resource_id,
                        quantity: d.quantity,
                        is_active: true
                    }))
                });
            }
        }

        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by ?? '',
            action: 'created',
            model_name: 'Activity',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });

        // Enqueue CPM recalc — fire-and-forget, non-blocking
        await enqueueRecalculate(created.workpack_id, data.organization_id);

        return created;
    }

    static async updateActivity(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const oldValues = await prisma.activity.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Activity not found');
        const updated = await prisma.activity.update({
            where: { id, organization_id: organizationId },
            data: { ...data, updated_by: updatedBy },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'Activity',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });

        // Enqueue CPM recalc (schedule-relevant fields like duration/dates may have changed)
        await enqueueRecalculate(updated.workpack_id, organizationId);

        return updated;
    }

    static async deleteActivity(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.activity.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Activity not found');
        const updated = await prisma.activity.update({ where: { id, organization_id: organizationId }, data: { deleted_at: new Date() } });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'Activity',
            model_id: id,
            old_values: oldValues as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
            site_id: oldValues.site_id ?? undefined,
        });

        // Enqueue CPM recalc — deletion changes the critical path
        await enqueueRecalculate(oldValues.workpack_id, organizationId);

        return updated;
    }

    static async reorderActivities(workpackId: string, organizationId: string, orderedIds: string[]) {
        await prisma.$transaction(
            orderedIds.map((id, index) =>
                prisma.activity.update({ where: { id, organization_id: organizationId }, data: { sequence_number: index + 1 } })
            )
        );
        // Sequence changes don't affect CPM — no recalc needed here
    }

    static async updateProgress(id: string, organizationId: string, percent: number, updatedBy: string) {
        const oldValues = await prisma.activity.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Activity not found');
        const status: ActivityStatus =
            percent === 0 ? 'not_started' :
                percent === 100 ? 'completed' : 'in_progress';
        if (percent === 100) {
            const activity = await prisma.activity.findUnique({
                where: { id, organization_id: organizationId },
                include: { qa_clearances: true }
            });
            if (activity?.hold_point_type === 'H' && (!activity.qa_clearances || activity.qa_clearances.length === 0)) {
                throw new Error('Cannot complete activity: QA Hold Point clearance required');
            }
        }

        const updated = await prisma.activity.update({
            where: { id, organization_id: organizationId },
            data: {
                progress_percent: percent,
                status,
                actual_start: (percent > 0 && !oldValues.actual_start) ? new Date() : undefined,
                actual_end: percent === 100 ? new Date() : undefined,
                updated_by: updatedBy,
            },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'Activity',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        // Emit progress update event
        (eventBus as { emit: (e: string, d: unknown) => boolean }).emit('activity.progress_updated', {
            activityId: id,
            workpackId: updated.workpack_id!,
            progressPercent: percent,
        });

        // Progress changes affect EVM / S-curve, not CPM topology — skip full recalc
        // (If EVM recalculation is added to the worker later, enqueue here too)

        return updated;
    }

    static async approveForScheduling(id: string, organizationId: string, approvedBy: string) {
        const oldValues = await prisma.activity.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Activity not found');
        const updated = await prisma.activity.update({
            where: { id, organization_id: organizationId },
            data: { is_approved_for_scheduling: true, updated_by: approvedBy },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: approvedBy,
            action: 'updated',
            model_name: 'Activity',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        (eventBus as { emit: (e: string, d: unknown) => boolean }).emit('activity.approved_for_scheduling', {
            activityId: id,
            workpackId: updated.workpack_id!,
        });

        // Approval may open this activity to the schedule — trigger recalc
        await enqueueRecalculate(updated.workpack_id, organizationId);

        return updated;
    }
}
