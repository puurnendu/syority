import { prisma } from '@/lib/prisma';
import { ScheduleActivityInput } from '@/lib/scheduleEngine';

export interface EffectiveActivity extends ScheduleActivityInput {
  // We can attach more metadata if needed, but standard input is fine
}

export class ScenarioDomainService {
  /**
   * Resolves the "Effective Activities" for a scenario by taking the base baseline 
   * and applying the scenario overrides.
   */
  static async resolveEffectiveActivities(
    scenarioId: string,
    organizationId: string
  ): Promise<EffectiveActivity[]> {
    // 1. Fetch scenario and verify ownership
    const scenario = await prisma.scheduleScenario.findFirst({
      where: {
        id: scenarioId,
        organization_id: organizationId,
      },
      include: {
        activity_overrides: {
          where: { is_active: true }
        }
      }
    });

    if (!scenario) {
      throw new Error(`Scenario not found or access denied: ${scenarioId}`);
    }

    if (!scenario.base_baseline_id) {
      throw new Error(`Scenario ${scenarioId} does not have a base_baseline_id.`);
    }

    // 2. Fetch baseline activities and live activity metadata
    const baselineActivities = await prisma.baselineActivity.findMany({
      where: {
        baseline_id: scenario.base_baseline_id,
        organization_id: organizationId,
      }
    });

    // 3. We need description and activity_number from the live Activity table
    const activityIds = baselineActivities.map(ba => ba.activity_id);
    const liveActivities = await prisma.activity.findMany({
      where: {
        id: { in: activityIds },
        organization_id: organizationId,
      },
      select: {
        id: true,
        activity_number: true,
        description: true,
        wbs_code: true,
        discipline_id: true,
        status: true
      }
    });

    const liveMap = new Map(liveActivities.map(a => [a.id, a]));
    const overrideMap = new Map(scenario.activity_overrides.map(o => [o.activity_id, o]));

    // 4. Resolve the EffectiveActivities
    const effectiveActivities: EffectiveActivity[] = [];

    for (const ba of baselineActivities) {
      const live = liveMap.get(ba.activity_id);
      if (!live) {
        continue;
      }

      const override = overrideMap.get(ba.activity_id);
      
      // Validation: reject negative duration
      if (override?.duration_hours !== undefined && override.duration_hours !== null) {
        if (Number(override.duration_hours) < 0) {
          throw new Error(`Validation Error: Negative duration override for activity ${ba.activity_id}`);
        }
      }

      const resolvedDuration = override?.duration_hours !== undefined && override.duration_hours !== null 
        ? Number(override.duration_hours) 
        : ba.duration;

      const resolvedStart = override?.planned_start || ba.planned_start;
      const resolvedEnd = override?.planned_end || ba.planned_finish;

      effectiveActivities.push({
        id: ba.activity_id, // we pass the original activity_id so relationships map correctly
        activity_number: live.activity_number,
        description: live.description,
        wbs_code: live.wbs_code,
        discipline_id: live.discipline_id,
        status: ba.status || live.status || undefined,
        duration_hours: resolvedDuration,
        planned_start: resolvedStart,
        planned_end: resolvedEnd,
      });
    }

    return effectiveActivities;
  }
}
