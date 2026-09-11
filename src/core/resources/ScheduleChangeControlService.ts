/**
 * M8.8 — Schedule Change Control Service
 *
 * Manages the lifecycle of schedule change requests:
 *   PROPOSED → REVIEW → APPROVED → APPLIED
 *                     ↘ REJECTED
 *                     ↘ SUPERSEDED
 *
 * Pattern mirrors: ScopeChangeRequest lifecycle in M8.6
 * Uses ResourceLevelingApplyService for actual schedule mutations (when source is leveling).
 */
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { PlannedDateAuthority } from '@/core/schedule/PlannedDateAuthority';

// ── Types ──────────────────────────────────────────────────────────────

export type ChangeRequestStatus = 'proposed' | 'review' | 'approved' | 'rejected' | 'applied' | 'superseded';
export type ChangeType = 'date_shift' | 'duration_change' | 'resource_reallocation' | 'leveling_apply';

export interface CreateChangeRequestInput {
  event_id: string;
  organization_id: string;
  change_type: ChangeType;
  title: string;
  description?: string;
  scenario_id?: string;
  simulation_data?: any;
  activities_affected?: number;
  float_consumed?: number;
  project_finish_delta?: number;
  constraints_resolved?: number;
  submitted_by: string;
}

export interface ReviewAction {
  action: 'approve' | 'reject';
  reviewed_by: string;
  review_notes?: string;
}

export interface ChangeRequestSummary {
  id: string;
  event_id: string;
  change_type: string;
  title: string;
  description: string | null;
  status: string;
  activities_affected: number;
  float_consumed: number | null;
  project_finish_delta: number | null;
  submitted_by: string;
  submitted_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  applied_at: Date | null;
}

// ── Service ────────────────────────────────────────────────────────────

export class ScheduleChangeControlService {

  /**
   * Create a new schedule change request.
   */
  static async createChangeRequest(input: CreateChangeRequestInput): Promise<string> {
    // Verify event belongs to organization
    const event = await prisma.event.findFirst({
      where: {
        id: input.event_id,
        organization_id: input.organization_id,
        deleted_at: null,
      },
    });
    if (!event) {
      throw new Error('Event not found or access denied');
    }

    const id = uuidv4();
    await prisma.scheduleChangeRequest.create({
      data: {
        id,
        organization_id: input.organization_id,
        event_id: input.event_id,
        change_type: input.change_type,
        title: input.title,
        description: input.description ?? null,
        scenario_id: input.scenario_id ?? null,
        simulation_data: input.simulation_data ?? null,
        activities_affected: input.activities_affected ?? 0,
        float_consumed: input.float_consumed ?? 0,
        project_finish_delta: input.project_finish_delta ?? 0,
        constraints_resolved: input.constraints_resolved ?? 0,
        status: 'proposed',
        submitted_by: input.submitted_by,
      },
    });

    return id;
  }

  /**
   * List change requests for an event, newest first.
   */
  static async listChangeRequests(
    eventId: string,
    organizationId: string,
    status?: ChangeRequestStatus
  ): Promise<ChangeRequestSummary[]> {
    const where: any = {
      event_id: eventId,
      organization_id: organizationId,
    };
    if (status) where.status = status;

    const requests = await prisma.scheduleChangeRequest.findMany({
      where,
      orderBy: { submitted_at: 'desc' },
    });

    return requests.map(r => ({
      id: r.id,
      event_id: r.event_id,
      change_type: r.change_type,
      title: r.title,
      description: r.description,
      status: r.status,
      activities_affected: r.activities_affected,
      float_consumed: r.float_consumed,
      project_finish_delta: r.project_finish_delta,
      submitted_by: r.submitted_by,
      submitted_at: r.submitted_at,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      review_notes: r.review_notes,
      applied_at: r.applied_at,
    }));
  }

  /**
   * Get a single change request by ID.
   */
  static async getChangeRequest(
    requestId: string,
    organizationId: string
  ): Promise<any | null> {
    return prisma.scheduleChangeRequest.findFirst({
      where: {
        id: requestId,
        organization_id: organizationId,
      },
    });
  }

  /**
   * Review (approve or reject) a change request.
   */
  static async reviewChangeRequest(
    requestId: string,
    organizationId: string,
    review: ReviewAction
  ): Promise<void> {
    const cr = await prisma.scheduleChangeRequest.findFirst({
      where: {
        id: requestId,
        organization_id: organizationId,
      },
    });

    if (!cr) {
      throw new Error('Change request not found or access denied');
    }

    if (cr.status !== 'proposed' && cr.status !== 'review') {
      throw new Error(`Cannot review a change request with status '${cr.status}'`);
    }

    const newStatus = review.action === 'approve' ? 'approved' : 'rejected';

    await prisma.scheduleChangeRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewed_by: review.reviewed_by,
        reviewed_at: new Date(),
        review_notes: review.review_notes ?? null,
      },
    });
  }

  /**
   * Apply an approved change request.
   *
   * - Only approved requests can be applied
   * - Validates activity ownership (event + org) before mutating
   * - Creates an audit log entry with before/after snapshots
   * - Supersedes any other pending requests for the same event
   * - All mutations are transactional
   */
  static async applyChangeRequest(
    requestId: string,
    organizationId: string,
    appliedBy: string
  ): Promise<{ success: boolean; activities_updated: number }> {
    const cr = await prisma.scheduleChangeRequest.findFirst({
      where: {
        id: requestId,
        organization_id: organizationId,
      },
    });

    if (!cr) {
      throw new Error('Change request not found or access denied');
    }

    if (cr.status !== 'approved') {
      throw new Error(`Cannot apply a change request with status '${cr.status}'. Only approved requests can be applied.`);
    }

    let activitiesUpdated = 0;
    const beforeAfterSnapshots: Array<{ activity_id: string; before: any; after: any }> = [];

    // Apply changes in a transaction
    await prisma.$transaction(async (tx) => {
      const simData = cr.simulation_data as any;

      if (simData && simData.changes && Array.isArray(simData.changes)) {
        // Collect all activity IDs from the change set
        const activityIds = simData.changes
          .map((c: any) => c.activity_id)
          .filter(Boolean);

        // Verify ALL referenced activities belong to this event + org
        if (activityIds.length > 0) {
          const validActivities = await tx.activity.findMany({
            where: {
              id: { in: activityIds },
              event_id: cr.event_id,
              organization_id: organizationId,
              deleted_at: null,
            },
            select: {
              id: true,
              planned_start: true,
              planned_end: true,
              duration_hours: true,
            },
          });

          const validIds = new Set(validActivities.map(a => a.id));
          const invalidIds = activityIds.filter((id: string) => !validIds.has(id));

          if (invalidIds.length > 0) {
            throw new Error(
              `Activity ownership validation failed: ${invalidIds.length} activity(s) do not belong to event ${cr.event_id} / org ${organizationId}`
            );
          }

          // Build before-state lookup
          const beforeMap = new Map(validActivities.map(a => [a.id, {
            planned_start: a.planned_start,
            planned_end: a.planned_end,
            duration_hours: a.duration_hours,
          }]));

          // Apply each proposed change
          for (const change of simData.changes) {
            if (!change.activity_id || !validIds.has(change.activity_id)) continue;

            const updateData: any = {};
            if (change.new_duration !== undefined) updateData.duration_hours = change.new_duration;

            if (change.new_start !== undefined || change.new_end !== undefined) {
              await PlannedDateAuthority.applyOverride({
                organizationId,
                activityId: change.activity_id,
                userId: appliedBy,
                reason: cr.review_notes || cr.description || cr.title || 'Approved schedule change request',
                source: 'schedule_change_control',
                planned_start: change.new_start,
                planned_end: change.new_end,
              }, tx);
              updateData.planned_start = change.new_start;
              updateData.planned_end = change.new_end;
            }

            if (change.new_duration !== undefined) {
              await tx.activity.update({
                where: { id: change.activity_id },
                data: { duration_hours: change.new_duration },
              });
            }

            if (Object.keys(updateData).length > 0) {

              beforeAfterSnapshots.push({
                activity_id: change.activity_id,
                before: beforeMap.get(change.activity_id) || null,
                after: updateData,
              });

              activitiesUpdated++;
            }
          }
        }
      }

      // Mark this CR as applied
      await tx.scheduleChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'applied',
          applied_at: new Date(),
          applied_by: appliedBy,
        },
      });

      // Supersede other pending requests for this event
      await tx.scheduleChangeRequest.updateMany({
        where: {
          event_id: cr.event_id,
          organization_id: organizationId,
          status: { in: ['proposed', 'review'] },
          id: { not: requestId },
        },
        data: { status: 'superseded' },
      });

      // Create audit log with before/after snapshots
      await tx.auditLog.create({
        data: {
          id: uuidv4(),
          organization_id: organizationId,
          auditable_type: 'ScheduleChangeRequest',
          auditable_id: requestId,
          event: 'SCHEDULE_CHANGE_APPLIED',
          old_values: { snapshots: beforeAfterSnapshots.map(s => ({ activity_id: s.activity_id, ...s.before })) },
          new_values: {
            activities_updated: activitiesUpdated,
            change_type: cr.change_type,
            snapshots: beforeAfterSnapshots.map(s => ({ activity_id: s.activity_id, ...s.after })),
          },
          user_id: appliedBy,
        },
      });
    }, {
      timeout: 60000,
    });

    return { success: true, activities_updated: activitiesUpdated };
  }
}
