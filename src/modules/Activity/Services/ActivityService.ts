import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { enqueueEventScheduleRecalculate } from '@/core/schedule/enqueueEventScheduleRecalculate';
import { ExecutionWriteService } from '@/core/execution/ExecutionWriteService';
import { listedExecutionFields, EXECUTION_FIELD_REJECT_MESSAGE } from '@/core/execution/executionFieldGuard';
import { createActivity } from '@/core/activity/ActivityCreationCommand';
import type { ActivityCreationSource } from '@/core/activity/ActivityCreationCommand';
import { assertNoSilentPlannedDateWrite } from '@/core/schedule/plannedDateGuard';

/**
 * Event-authoritative CPM enqueue. Does not infer Event from Project.
 * Event-less rows are deferred — they do not guess an Event.
 */
async function enqueueRecalculate(
  orgId: string,
  eventId?: string | null,
  workpackId?: string | null
) {
  const result = await enqueueEventScheduleRecalculate({
    organizationId: orgId,
    eventId,
    workpackId,
  });
  if (!result.enqueued) {
    console.warn('[ActivityService] CPM enqueue deferred:', result.code);
  }
}

export type ActivityServiceCreateInput = {
        organization_id: string;
        created_by: string;
        description: string;
        workpack_id?: string;
        site_id?: string;
        event_id?: string;
        duration_hours?: number;
        discipline_id?: string;
        discipline?: string;
        work_category?: string;
        notes?: string;
        activity_number?: string;
        activity_id?: string;
        activity_library_id?: string;
        activity_code?: string;
        standard_activity_type_id?: string;
        standard_activity_type?: string;
        hold_point_type?: string;
        hold_point_description?: string;
        wbs_code?: string;
        window?: string;
        responsible?: string;
        planned_start?: Date | string | null;
        planned_end?: Date | string | null;
        asset_id?: string;
        equipment_type_id?: string;
        equipment_type?: string;
        contractor_id?: string;
        scope_item_id?: string;
        project_id?: string;
        allow_loose?: boolean;
        source_channel?: ActivityCreationSource;
        sequence_number?: number;
        is_optional?: boolean;
    };

export class ActivityService {
    /**
     * Compatibility adapter. All identity validation lives in
     * ActivityCreationCommand — this method must not write Activity rows itself.
     */
    static async createActivity(data: ActivityServiceCreateInput) {
        const created = await createActivity(
            {
                organizationId: data.organization_id,
                userId: data.created_by,
                sourceChannel: data.source_channel ?? 'api',
                eventId: data.event_id,
            },
            {
                workpackId: data.workpack_id,
                allowLoose: data.allow_loose === true || (!data.workpack_id && (!!data.event_id || !!data.project_id)),
                description: data.description,
                siteId: data.site_id,
                activityNumber: data.activity_number,
                activityId: data.activity_id,
                durationHours: data.duration_hours,
                disciplineId: data.discipline_id,
                discipline: data.discipline,
                workCategory: data.work_category,
                notes: data.notes,
                activityLibraryId: data.activity_library_id,
                activityCode: data.activity_code,
                standardActivityTypeId: data.standard_activity_type_id,
                standardActivityType: data.standard_activity_type,
                holdPointType: data.hold_point_type,
                holdPointDescription: data.hold_point_description,
                wbsCode: data.wbs_code,
                window: data.window,
                responsible: data.responsible,
                plannedStart: data.planned_start ? new Date(data.planned_start) : null,
                plannedEnd: data.planned_end ? new Date(data.planned_end) : null,
                assetId: data.asset_id,
                equipmentTypeId: data.equipment_type_id,
                equipmentType: data.equipment_type,
                contractorId: data.contractor_id,
                scopeItemId: data.scope_item_id,
                legacyProjectId: data.project_id,
                sequenceNumber: data.sequence_number,
                isOptional: data.is_optional,
            }
        );

        try {
            await enqueueRecalculate(data.organization_id, created.event_id, created.workpack_id);
        } catch (err) {
            console.error('[ActivityService] schedule recalc enqueue failed:', err);
        }

        return created;
    }

    static async updateActivity(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const executionFields = listedExecutionFields(data);
        if (executionFields.length > 0) {
            throw new Error(`${EXECUTION_FIELD_REJECT_MESSAGE} Rejected fields: ${executionFields.join(', ')}`);
        }
        assertNoSilentPlannedDateWrite(data);
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
        await enqueueRecalculate(organizationId, updated.event_id, updated.workpack_id);

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
        await enqueueRecalculate(organizationId, oldValues.event_id, oldValues.workpack_id);

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
        const result = await ExecutionWriteService.applyAction(
            organizationId,
            updatedBy,
            { activityId: id, action: 'UPDATE_PROGRESS', progress: percent },
            { source_channel: 'api' }
        );
        return result.activity;
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
        await enqueueRecalculate(organizationId, updated.event_id, updated.workpack_id);

        return updated;
    }
}
