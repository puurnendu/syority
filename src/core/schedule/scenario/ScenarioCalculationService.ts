import { prisma } from '@/lib/prisma';
import { ScenarioDomainService } from './ScenarioDomainService';
import { calculateSchedule, ScheduleRelationshipInput } from '@/lib/scheduleEngine';
import { ResourcePlanningService, ResourceActivityInput } from '@/core/resources/ResourcePlanningService';
import { ResourceConstraintService } from '@/core/resources/ResourceConstraintService';
import { ScheduleHealthService } from '@/core/resources/ScheduleHealthService';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';

export class ScenarioCalculationService {
  /**
   * Orchestrates the calculation of a scenario:
   * 1. Changes state to 'calculating'
   * 2. Resolves effective activities
   * 3. Runs CPM Engine
   * 4. Runs pure Resource Constraint Analysis
   * 5. Computes Scenario SHI & Health Metrics
   * 6. Saves full snapshot and changes state to 'ready'
   */
  static async calculate(scenarioId: string, organizationId: string, userId: string) {
    // 1. Fetch Scenario and enforce state machine
    const scenario = await prisma.scheduleScenario.findFirst({
      where: { id: scenarioId, organization_id: organizationId },
    });

    if (!scenario) {
      throw new Error('Scenario not found or access denied');
    }

    if (scenario.status === 'calculating' || scenario.status === 'ready' || scenario.status === 'approved') {
      throw new Error(`Cannot calculate scenario in state: ${scenario.status}`);
    }

    // Lock to calculating
    await prisma.scheduleScenario.update({
      where: { id: scenarioId },
      data: { status: 'calculating', updated_at: new Date() }
    });

    try {
      // 2. Resolve Effective Activities
      const effectiveActivities = await ScenarioDomainService.resolveEffectiveActivities(
        scenarioId,
        organizationId
      );

      const activityIds = effectiveActivities.map(a => a.id);

      // 3. Fetch relationships connecting scenario activities in THIS event only
      const liveRelationships = await prisma.activityRelationship.findMany({
        where: {
          organization_id: organizationId,
          predecessor_id: { in: activityIds },
          successor_id: { in: activityIds },
          predecessor: { event_id: scenario.event_id, organization_id: organizationId },
          successor: { event_id: scenario.event_id, organization_id: organizationId },
        }
      });

      const scheduleRelationships: ScheduleRelationshipInput[] = liveRelationships.map(r => ({
        id: r.id,
        predecessor_id: r.predecessor_id,
        successor_id: r.successor_id,
        relationship_type: r.relationship_type as any,
        lag_days: r.lag_days,
        lag_minutes: r.lag_minutes,
      }));

      const hoursPerDay = await ScheduleOrchestrationService.resolveWorkingHoursPerDay(
        scenario.event_id,
        organizationId
      );

      // 4. Run CPM Engine (in-memory only — results stay on the scenario snapshot)
      const cpmResult = calculateSchedule(effectiveActivities, scheduleRelationships, {
        working_hours_per_day: hoursPerDay,
      });

      if (!cpmResult.success) {
        throw new Error(`CPM Calculation failed: ${cpmResult.error}`);
      }

      // 5. Genuine Resource Constraint Analysis
      // Retrieve resource assignments from ActivityResource
      const activityResources = await prisma.activityResource.findMany({
        where: {
          organization_id: organizationId,
          activity_id: { in: activityIds }
        },
        select: {
          activity_id: true,
          resource_type_id: true,
          contractor_id: true,
          planned_hours: true,
          headcount: true,
          crew_size: true,
          resource_type: true,
          quantity: true
        }
      });

      // Group resources by activity_id
      const resourcesByAct = new Map<string, any[]>();
      for (const r of activityResources) {
        const list = resourcesByAct.get(r.activity_id) || [];
        list.push(r);
        resourcesByAct.set(r.activity_id, list);
      }

      // Fetch event resource capacities and resource types
      const capacities = await ResourcePlanningService.listCapacity(scenario.event_id, organizationId);
      const allResourceTypes = await prisma.resourceType.findMany({
        where: { organization_id: organizationId },
        select: { id: true, name: true }
      });
      const rtNames = new Map(allResourceTypes.map(rt => [rt.id, rt.name]));

      // Map scenario calculated activities with resources
      const scenarioResourceActivities: ResourceActivityInput[] = cpmResult.activities.map(act => ({
        id: act.id,
        description: act.description,
        planned_start: act.early_start,
        duration_hours: act.duration_hours,
        is_critical: act.is_critical,
        total_float: act.total_float_days,
        resources: resourcesByAct.get(act.id) || []
      }));

      // Pure demand vs capacity calculation
      const loadingResults = ResourcePlanningService.calculateDemandVsCapacity(
        scenarioResourceActivities,
        capacities,
        rtNames
      );

      // Pure resource constraint detection
      const scenarioConstraints = ResourceConstraintService.analyzeConstraints({
        eventId: scenario.event_id,
        activities: scenarioResourceActivities,
        loadingResults
      });

      // 6. Calculate Scenario Health & SHI
      const baselineActivities = scenario.base_baseline_id ? await prisma.baselineActivity.findMany({
        where: {
          baseline_id: scenario.base_baseline_id,
          organization_id: organizationId,
        }
      }) : [];

      const healthResult = await ScheduleHealthService.calculateScenarioHealth({
        eventId: scenario.event_id,
        organizationId,
        scenarioActivities: cpmResult.activities,
        baselineActivities: baselineActivities.map(b => ({
          activity_id: b.activity_id,
          planned_start: b.planned_start,
          planned_finish: b.planned_finish,
          duration: b.duration ? Number(b.duration) : null,
          total_float: b.total_float ? Number(b.total_float) : null
        })),
        constraints: scenarioConstraints
      });

      // 7. Calculate Impact Metrics against base baseline
      const activitiesAffected = await prisma.scenarioActivityOverride.count({
        where: { scenario_id: scenarioId, is_active: true }
      });

      let baselineFinish: Date | null = null;
      for (const ba of baselineActivities) {
        if (ba.planned_finish) {
          const d = new Date(ba.planned_finish);
          if (!baselineFinish || d > baselineFinish) baselineFinish = d;
        }
      }
      const scenarioFinish = cpmResult.project_finish ? new Date(cpmResult.project_finish) : null;
      let projectFinishDelta = 0;
      if (baselineFinish && scenarioFinish) {
        projectFinishDelta = (scenarioFinish.getTime() - baselineFinish.getTime()) / (24 * 60 * 60 * 1000);
        projectFinishDelta = Math.round(projectFinishDelta * 10) / 10;
      }

      // Calculate total float consumed
      const baseMap = new Map(baselineActivities.map(b => [b.activity_id, b]));
      let floatConsumed = 0;
      for (const sa of cpmResult.activities) {
        const ba = baseMap.get(sa.id);
        if (ba && ba.total_float !== null && ba.total_float !== undefined) {
          const baseFloat = Number(ba.total_float);
          const delta = baseFloat - sa.total_float_days;
          if (delta > 0) floatConsumed += delta;
        }
      }
      floatConsumed = Math.round(floatConsumed * 10) / 10;

      // 8. Build Comprehensive Snapshot
      const snapshotJson = {
        calculation_time: new Date().toISOString(),
        engine_version: "M8.9-CPM-RESOURCE",
        scenario_id: scenarioId,
        base_baseline_id: scenario.base_baseline_id,
        calendar: {
          working_hours_per_day: hoursPerDay,
          source: 'M11 ScheduleOrchestrationService.resolveWorkingHoursPerDay',
        },
        cpm_result: {
          project_start: cpmResult.project_start,
          project_finish: cpmResult.project_finish,
          total_duration_days: cpmResult.total_duration_days,
          total_duration_hours: cpmResult.total_duration_hours,
          critical_path_ids: cpmResult.critical_path_ids,
          activities: cpmResult.activities,
          warnings: cpmResult.warnings,
        },
        resource_analysis: {
          status: 'calculated',
          total_constraints: scenarioConstraints.length,
          critical_count: scenarioConstraints.filter(c => c.severity === 'CRITICAL').length,
          high_count: scenarioConstraints.filter(c => c.severity === 'HIGH').length,
          warning_count: scenarioConstraints.filter(c => c.severity === 'WARNING').length,
          info_count: scenarioConstraints.filter(c => c.severity === 'INFO').length,
          constraints: scenarioConstraints,
          over_allocated_buckets: loadingResults.filter(l => l.is_over_allocated),
        },
        health_metrics: {
          shi: healthResult.shi,
          classification: healthResult.classification,
          components: healthResult.components,
        },
        impact_summary: {
          activities_affected: activitiesAffected,
          float_consumed: floatConsumed,
          project_finish_delta: projectFinishDelta,
          constraints_resolved: 0,
        }
      };

      // 9. Persist to Scenario and transition to 'ready'
      await prisma.scheduleScenario.update({
        where: { id: scenarioId },
        data: {
          status: 'ready',
          snapshot_json: snapshotJson as any,
          activities_affected: activitiesAffected,
          float_consumed: floatConsumed,
          project_finish_delta: projectFinishDelta,
          constraints_resolved: 0,
          updated_at: new Date()
        }
      });

      return { success: true, message: 'Calculation complete', snapshot: snapshotJson };

    } catch (error: any) {
      // Revert to draft on failure
      await prisma.scheduleScenario.update({
        where: { id: scenarioId },
        data: { status: 'draft', updated_at: new Date() }
      });
      throw error;
    }
  }
}

