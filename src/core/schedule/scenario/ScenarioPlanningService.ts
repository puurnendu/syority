import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ScenarioCalculationService } from './ScenarioCalculationService';

export class ScenarioPlanningService {
  /**
   * Create a new draft scenario
   */
  static async createScenario(
    organizationId: string,
    eventId: string,
    userId: string,
    input: { name: string; description?: string; base_baseline_id: string }
  ) {
    // Validate base baseline exists
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: { id: input.base_baseline_id, organization_id: organizationId, event_id: eventId }
    });

    if (!baseline) {
      throw new Error('Base baseline not found or access denied');
    }

    return prisma.scheduleScenario.create({
      data: {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        event_id: eventId,
        name: input.name,
        description: input.description,
        base_baseline_id: input.base_baseline_id,
        status: 'draft',
        source_type: 'manual',
        created_by: userId,
        snapshot_json: {}, // Empty snapshot initially
      }
    });
  }

  /**
   * Get scenario details including overrides
   */
  static async getScenario(scenarioId: string, organizationId: string) {
    const scenario = await prisma.scheduleScenario.findFirst({
      where: { id: scenarioId, organization_id: organizationId },
      include: {
        activity_overrides: true,
        base_baseline: true,
      }
    });

    if (!scenario) throw new Error('Scenario not found');
    return scenario;
  }

  /**
   * Add or update an activity override in a draft scenario
   */
  static async setActivityOverride(
    scenarioId: string,
    organizationId: string,
    userId: string,
    input: {
      activity_id: string;
      duration_hours?: number;
      planned_start?: string;
      planned_end?: string;
    }
  ) {
    // Enforce state
    const scenario = await prisma.scheduleScenario.findFirst({
      where: { id: scenarioId, organization_id: organizationId }
    });

    if (!scenario) throw new Error('Scenario not found');
    if (scenario.status !== 'draft') {
      throw new Error(`Cannot modify overrides when scenario is in status: ${scenario.status}`);
    }

    // Verify activity exists in base baseline
    const ba = await prisma.baselineActivity.findFirst({
      where: { baseline_id: scenario.base_baseline_id!, activity_id: input.activity_id }
    });

    if (!ba) {
      throw new Error(`Activity ${input.activity_id} is not part of the base baseline.`);
    }

    const live = await prisma.activity.findFirst({
      where: {
        id: input.activity_id,
        organization_id: organizationId,
        event_id: scenario.event_id,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!live) {
      throw new Error('Activity not found for this organization and scenario event');
    }

    if (input.duration_hours !== undefined && input.duration_hours < 0) {
        throw new Error('Duration cannot be negative');
    }

    // Upsert Override
    return prisma.scenarioActivityOverride.upsert({
      where: {
        scenario_id_activity_id: {
          scenario_id: scenarioId,
          activity_id: input.activity_id,
        }
      },
      update: {
        duration_hours: input.duration_hours !== undefined ? input.duration_hours : undefined,
        planned_start: input.planned_start ? new Date(input.planned_start) : undefined,
        planned_end: input.planned_end ? new Date(input.planned_end) : undefined,
        is_active: true,
      },
      create: {
        id: crypto.randomUUID(),
        scenario_id: scenarioId,
        activity_id: input.activity_id,
        duration_hours: input.duration_hours !== undefined ? input.duration_hours : undefined,
        planned_start: input.planned_start ? new Date(input.planned_start) : undefined,
        planned_end: input.planned_end ? new Date(input.planned_end) : undefined,
        is_active: true,
      }
    });
  }

  /**
   * Remove an override
   */
  static async removeActivityOverride(
    scenarioId: string,
    organizationId: string,
    activityId: string
  ) {
    const scenario = await prisma.scheduleScenario.findFirst({
      where: { id: scenarioId, organization_id: organizationId }
    });

    if (!scenario) throw new Error('Scenario not found');
    if (scenario.status !== 'draft') {
      throw new Error(`Cannot modify overrides when scenario is in status: ${scenario.status}`);
    }

    try {
      await prisma.scenarioActivityOverride.delete({
        where: {
          scenario_id_activity_id: {
            scenario_id: scenarioId,
            activity_id: activityId,
          }
        }
      });
      return true;
    } catch (e) {
      // Ignore if not found
      return false;
    }
  }

  /**
   * Transition scenario status (draft <-> ready -> proposed)
   */
  static async transitionStatus(
    scenarioId: string,
    organizationId: string,
    newStatus: string
  ) {
    const scenario = await prisma.scheduleScenario.findFirst({
      where: { id: scenarioId, organization_id: organizationId }
    });

    if (!scenario) throw new Error('Scenario not found');
    
    // Only allow specific transitions
    const validTransitions: Record<string, string[]> = {
      'draft': ['ready', 'archived'],
      'ready': ['draft', 'proposed', 'archived'], // draft means unlocking to edit
      'proposed': ['approved', 'rejected', 'draft'],
      'rejected': ['archived', 'draft'],
    };

    const allowed = validTransitions[scenario.status] || [];
    
    // Bypass transition logic if moving to 'calculating', handled by CalculationService
    if (newStatus !== 'calculating' && !allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${scenario.status} to ${newStatus}`);
    }

    return prisma.scheduleScenario.update({
      where: { id: scenarioId },
      data: { status: newStatus }
    });
  }

  /**
   * Trigger Calculation
   */
  static async calculateScenario(
    scenarioId: string,
    organizationId: string,
    userId: string
  ) {
    return ScenarioCalculationService.calculate(scenarioId, organizationId, userId);
  }

  /**
   * Promote a Scenario to a Schedule Change Request
   */
  static async promoteScenario(
    scenarioId: string,
    organizationId: string,
    userId: string
  ) {
    const scenario = await prisma.scheduleScenario.findFirst({
      where: { id: scenarioId, organization_id: organizationId },
      include: {
        activity_overrides: true,
      }
    });

    if (!scenario) throw new Error('Scenario not found');
    
    // Only ready scenarios can be promoted
    if (scenario.status !== 'ready') {
      throw new Error(`Scenario must be in 'ready' state to promote. Current status: ${scenario.status}`);
    }

    // Stale Scenario Protection Check
    const staleCheck = await prisma.activity.findFirst({
      where: {
        event_id: scenario.event_id,
        updated_at: {
          gt: scenario.updated_at
        }
      }
    });

    if (staleCheck) {
      throw new Error(`Stale Scenario Protection: Live activities have been modified since this scenario was last updated.`);
    }

    // Build simulation_data for the Change Request
    const changes = scenario.activity_overrides.map((override: any) => ({
      activity_id: override.activity_id,
      new_start: override.planned_start,
      new_end: override.planned_end,
      new_duration: override.duration_hours !== null ? Number(override.duration_hours) : undefined,
    }));

    // 1. Create the Schedule Change Request
    const cr = await prisma.scheduleChangeRequest.create({
      data: {
        organization_id: organizationId,
        event_id: scenario.event_id,
        scenario_id: scenario.id,
        source_scenario_id: scenario.id,
        title: `Promotion of Scenario: ${scenario.name}`,
        description: `Promoted from Scenario ${scenario.name} (${scenario.id}). ${scenario.description || ''}`,
        change_type: 'scenario_promotion',
        status: 'proposed',
        submitted_by: userId,
        simulation_data: { changes },
        activities_affected: changes.length,
      }
    });

    // 2. Transition the Scenario to proposed
    await this.transitionStatus(scenario.id, organizationId, 'proposed');

    return cr;
  }
}
