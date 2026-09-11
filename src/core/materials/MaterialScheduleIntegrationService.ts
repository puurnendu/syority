/**
 * M8.12 — Material Schedule Integration Service
 *
 * Integrates material constraints into the CPM calculation by adjusting
 * activity planned_start dates BEFORE calling calculateSchedule().
 *
 * CRITICAL: This service does NOT modify scheduleEngine.ts.
 * It operates at the boundary between material readiness and scheduling.
 *
 * Integration pattern:
 *   1. Load material constraints for event activities
 *   2. For activities with binding material constraints:
 *      - Adjust planned_start = max(planned_start, constraint_date)
 *   3. Pass adjusted activities to calculateSchedule()
 *   4. CPM naturally propagates the constraint through the network
 */
import { prisma } from '@/lib/prisma';
import { ScheduleActivityInput } from '@/lib/scheduleEngine';

export interface MaterialConstraintAdjustment {
  activity_id: string;
  original_planned_start: string | null;
  constraint_date: string;
  adjusted_planned_start: string;
  impact_days: number;
  reason: string;
}

export interface MaterialIntegrationResult {
  adjustments: MaterialConstraintAdjustment[];
  activities_adjusted: number;
  total_impact_days: number;
}

export class MaterialScheduleIntegrationService {

  /**
   * Load binding material constraints for an event and return the
   * adjustment map (activity_id → constraint_date).
   */
  static async loadBindingConstraints(
    eventId: string,
    orgId: string
  ): Promise<Map<string, Date>> {
    const constraints = await prisma.materialConstraint.findMany({
      where: {
        event_id: eventId,
        organization_id: orgId,
        is_binding: true,
        constraint_date: { not: null },
      },
      select: {
        activity_id: true,
        constraint_date: true,
      },
    });

    // For each activity, take the LATEST binding constraint date
    const constraintMap = new Map<string, Date>();
    for (const c of constraints) {
      if (!c.constraint_date) continue;
      const existing = constraintMap.get(c.activity_id);
      if (!existing || c.constraint_date > existing) {
        constraintMap.set(c.activity_id, c.constraint_date);
      }
    }

    return constraintMap;
  }

  /**
   * Apply material constraints to a set of ScheduleActivityInput objects.
   * Returns the adjusted activities + adjustment log.
   *
   * This is the PRIMARY integration point for CPM.
   * Call this BEFORE passing activities to calculateSchedule().
   */
  static applyConstraints(
    activities: ScheduleActivityInput[],
    constraintMap: Map<string, Date>
  ): { adjusted: ScheduleActivityInput[]; result: MaterialIntegrationResult } {
    const adjustments: MaterialConstraintAdjustment[] = [];
    let totalImpactDays = 0;

    const adjusted = activities.map((act) => {
      const constraint = constraintMap.get(act.id);
      if (!constraint) return act;

      const constraintDate = constraint;
      const originalStart = act.planned_start ? new Date(act.planned_start) : null;

      // Only adjust if constraint is later than planned start
      if (originalStart && constraintDate > originalStart) {
        const impactDays = (constraintDate.getTime() - originalStart.getTime()) / (24 * 60 * 60 * 1000);
        totalImpactDays += impactDays;

        adjustments.push({
          activity_id: act.id,
          original_planned_start: originalStart.toISOString().slice(0, 10),
          constraint_date: constraintDate.toISOString().slice(0, 10),
          adjusted_planned_start: constraintDate.toISOString().slice(0, 10),
          impact_days: Math.round(impactDays * 10) / 10,
          reason: 'Material constraint delays activity start',
        });

        return {
          ...act,
          planned_start: constraintDate.toISOString().slice(0, 10),
        };
      } else if (!originalStart) {
        // No planned start — set to constraint date
        adjustments.push({
          activity_id: act.id,
          original_planned_start: null,
          constraint_date: constraintDate.toISOString().slice(0, 10),
          adjusted_planned_start: constraintDate.toISOString().slice(0, 10),
          impact_days: 0,
          reason: 'Material constraint sets activity start (no original planned_start)',
        });

        return {
          ...act,
          planned_start: constraintDate.toISOString().slice(0, 10),
        };
      }

      return act;
    });

    return {
      adjusted,
      result: {
        adjustments,
        activities_adjusted: adjustments.length,
        total_impact_days: Math.round(totalImpactDays * 10) / 10,
      },
    };
  }

  /**
   * Convenience: Load constraints + apply to activities in one call.
   */
  static async integrateForEvent(
    eventId: string,
    orgId: string,
    activities: ScheduleActivityInput[]
  ): Promise<{ adjusted: ScheduleActivityInput[]; result: MaterialIntegrationResult }> {
    const constraintMap = await this.loadBindingConstraints(eventId, orgId);

    if (constraintMap.size === 0) {
      return {
        adjusted: activities,
        result: { adjustments: [], activities_adjusted: 0, total_impact_days: 0 },
      };
    }

    return this.applyConstraints(activities, constraintMap);
  }
}
