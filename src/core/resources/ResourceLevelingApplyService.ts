import { prisma } from '@/lib/prisma';
import { LevelingRecommendation } from './ResourceLevelingService';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';
import { PlannedDateAuthority } from '@/core/schedule/PlannedDateAuthority';

export interface ApplyLevelingRequest {
  simulation_id: string; // also serves as scenario_id
  recommendations: LevelingRecommendation[];
  scenario_metadata?: {
    constraints_before?: number;
    constraints_after?: number;
    constraints_resolved?: number;
    constraints_remaining?: number;
    project_finish_impact?: number;
    float_consumed?: number;
  };
}

/**
 * ResourceLevelingApplyService — applies user-approved leveling recommendations.
 *
 * M11-R1: This service applies leveling date-changes and audit logs atomically,
 * then delegates CPM recalculation to ScheduleOrchestrationService — the SOLE
 * authoritative CPM persistence path. It does NOT independently calculate or
 * persist CPM fields (ES/EF/LS/LF/TF/is_critical).
 *
 * Architecture:
 *   1. Validate recommendations (staleness, critical-activity, event ownership)
 *   2. $transaction: apply date changes + audit logs
 *   3. Delegate CPM recalculation to ScheduleOrchestrationService.calculateEventSchedule()
 *      → CalendarEngine (3-tier) → scheduleEngine.ts → authoritative persistence
 */
export class ResourceLevelingApplyService {
  static async validateRecommendations(
    eventId: string,
    organizationId: string,
    payload: ApplyLevelingRequest
  ): Promise<void> {
    // 1. Validate Event Ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId },
    });
    if (!event) throw new Error('Event not found or access denied');

    // 2. Validate Baseline Schedule
    const activityIds = payload.recommendations.map(r => r.activity_id);
    const activities = await prisma.activity.findMany({
      where: {
        id: { in: activityIds },
        organization_id: organizationId,
        workpack: { event_id: eventId }
      }
    });

    if (activities.length !== activityIds.length) {
      throw new Error('STALE_RECOMMENDATION: One or more activities were not found or belong to another event.');
    }

    for (const rec of payload.recommendations) {
      const activity = activities.find(a => a.id === rec.activity_id);
      if (!activity) continue;

      if (activity.status === 'cancelled' || activity.status === 'deleted') {
        throw new Error(`STALE_RECOMMENDATION: Activity ${activity.id} has been cancelled or deleted.`);
      }

      const currentStartIso = activity.planned_start ? activity.planned_start.toISOString() : null;
      const currentEndIso = activity.planned_end ? activity.planned_end.toISOString() : null;

      // The baseline states that the current_start/current_end at simulation time must match the current state in DB
      if (
        (rec.current_start && currentStartIso && new Date(rec.current_start).getTime() !== new Date(currentStartIso).getTime()) ||
        (!rec.current_start && currentStartIso) ||
        (rec.current_start && !currentStartIso)
      ) {
        throw new Error(`STALE_RECOMMENDATION: Baseline drift detected for Activity ${activity.id} (planned_start).`);
      }

      if (
        (rec.current_end && currentEndIso && new Date(rec.current_end).getTime() !== new Date(currentEndIso).getTime()) ||
        (!rec.current_end && currentEndIso) ||
        (rec.current_end && !currentEndIso)
      ) {
        throw new Error(`STALE_RECOMMENDATION: Baseline drift detected for Activity ${activity.id} (planned_end).`);
      }

      if (activity.is_critical) {
         throw new Error(`STALE_RECOMMENDATION: Validation failed. Activity ${activity.id} is critical and cannot be delayed.`);
      }
    }
  }

  /**
   * Apply approved leveling recommendations:
   *   1. Atomically apply date changes + audit logs inside $transaction
   *   2. Delegate CPM recalculation to the authoritative orchestration path
   *
   * M11-R1: CPM recalculation is performed AFTER the date-change transaction
   * commits, using ScheduleOrchestrationService.calculateEventSchedule().
   * This ensures:
   *   - CalendarEngine 3-tier resolution (no hardcoded 8h/day)
   *   - Float persisted in canonical unit (hours)
   *   - Single authoritative CPM persistence path
   */
  static async applyRecommendations(
    eventId: string,
    organizationId: string,
    userId: string,
    payload: ApplyLevelingRequest
  ): Promise<void> {
    await ResourceLevelingApplyService.validateRecommendations(eventId, organizationId, payload);

    const crypto = require('crypto');

    // Step 1: Atomically apply leveling date changes + audit logs
    await prisma.$transaction(async (tx) => {
      for (const rec of payload.recommendations) {
        // Apply changes
        await PlannedDateAuthority.applyOverride({
          organizationId,
          activityId: rec.activity_id,
          userId,
          reason: rec.reason || 'Approved resource-leveling recommendation',
          source: 'resource_leveling',
          planned_start: rec.proposed_start,
          planned_end: rec.proposed_end,
        }, tx);

        // Generate Audit Log
        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            organization_id: organizationId,
            site_id: null,
            auditable_type: 'Activity',
            auditable_id: rec.activity_id,
            event: 'RESOURCE_LEVELING_APPLIED',
            user_id: userId,
            old_values: {
              planned_start: rec.current_start,
              planned_end: rec.current_end,
              original_float: rec.float_before
            },
            new_values: {
              planned_start: rec.proposed_start,
              planned_end: rec.proposed_end,
              simulation_id: payload.simulation_id, // also scenario_id
              reason: rec.reason || 'resource_leveling',
              remaining_float: rec.float_after,
              float_consumed: rec.float_consumed,
              resource_type_id: rec.resources_affected?.[0], // simple capture
              scenario_metadata: payload.scenario_metadata || {} // 2I expanded audit properties
            }
          }
        });
      }
    });

    // Step 2: Recalculate CPM through the SOLE authoritative orchestration path
    // M11-R1: Delegates to ScheduleOrchestrationService which uses:
    //   - CalendarEngine 3-tier resolution (event → org default → fallback)
    //   - scheduleEngine.ts (FS/SS/FF/SF + lag)
    //   - Canonical float unit (hours)
    //   - Event-scoped queries with tenant isolation
    const cpmResult = await ScheduleOrchestrationService.calculateEventSchedule(
      eventId,
      organizationId,
      { persist: true }
    );

    if (!cpmResult.success) {
      // Leveling changes are already committed — log the CPM failure but don't
      // roll back the user-approved date changes. The schedule can be
      // recalculated later via the "Recalculate CPM" button.
      console.error(
        `[ResourceLevelingApplyService] CPM recalculation failed after leveling apply ` +
        `(eventId=${eventId}, simulation_id=${payload.simulation_id}): ${cpmResult.error}`
      );
    }
  }
}
