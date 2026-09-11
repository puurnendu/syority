/**
 * M8.11 — ScopeChangeImpactService
 *
 * In-memory impact analysis for scope change proposals.
 * Reads from Activity, Workpack, ScheduleBaseline, and ActivityResource
 * to project schedule, cost, and resource impacts.
 *
 * IMMUTABILITY: This service performs READ-ONLY queries on protected
 * M8.7/M8.8 tables. It writes ONLY to ScheduleScopeChange.impact_analysis.
 */
import { prisma } from '@/lib/prisma';

interface ImpactResult {
  schedule_impact_days: number;
  cost_impact: number;
  resource_impact_hours: number;
  critical_path_affected: boolean;
  details: {
    new_activities: number;
    modified_activities: number;
    removed_activities: number;
    new_workpacks: number;
    total_estimated_hours: number;
    total_estimated_cost: number;
    baseline_exists: boolean;
    event_duration_days: number;
    impact_percentage: number;
  };
}

export class ScopeChangeImpactService {
  /**
   * Analyze the impact of a scope change proposal.
   * Reads existing schedule data and projects the effect of proposed items.
   * Transitions scope change: draft → analyzing (if in draft)
   */
  static async analyze(scopeChangeId: string, orgId: string, eventId?: string | null): Promise<ImpactResult> {
    const where: { id: string; organization_id: string; event_id?: string } = {
      id: scopeChangeId,
      organization_id: orgId,
    };
    if (eventId) where.event_id = eventId;
    const sc = await prisma.scheduleScopeChange.findFirst({
      where,
      include: { items: true },
    });
    if (!sc) throw new Error('Scope change not found');
    if (sc.status !== 'draft' && sc.status !== 'analyzing') {
      throw new Error(`Cannot analyze scope change in '${sc.status}' status`);
    }

    // Transition to analyzing if in draft
    if (sc.status === 'draft') {
      await prisma.scheduleScopeChange.update({
        where: { id: scopeChangeId },
        data: { status: 'analyzing' },
      });
    }

    // ── Read baseline data (READ-ONLY) ──────────────────────────────
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: {
        organization_id: orgId,
        is_current: true,
      },
    });

    // ── Read event for duration context ─────────────────────────────
    const event = await prisma.event.findFirst({
      where: { id: sc.event_id, organization_id: orgId },
      select: { planned_start: true, planned_end: true },
    });

    const eventDurationDays = event?.planned_start && event?.planned_end
      ? Math.ceil(
          (event.planned_end.getTime() - event.planned_start.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

    // ── Aggregate item impacts ──────────────────────────────────────
    let totalHours = 0;
    let totalCost = 0;
    let newActivities = 0;
    let modifiedActivities = 0;
    let removedActivities = 0;
    let newWorkpacks = 0;

    for (const item of sc.items) {
      totalHours += item.estimated_hours;
      totalCost += item.estimated_cost;

      switch (item.item_type) {
        case 'new_activity':
          newActivities++;
          break;
        case 'new_workpack':
          newWorkpacks++;
          break;
        case 'modify_activity':
          modifiedActivities++;
          break;
        case 'remove_activity':
          removedActivities++;
          // Negative impact for removals
          totalHours -= item.estimated_hours * 2; // Subtract original + estimate
          totalCost -= item.estimated_cost * 2;
          break;
      }
    }

    // ── Project schedule impact ─────────────────────────────────────
    // Simple heuristic: 1 day per 8 hours of new work, adjusted by crew_size
    const avgCrewSize = sc.items.length > 0
      ? sc.items.reduce((sum, i) => sum + i.crew_size, 0) / sc.items.length
      : 1;
    const scheduleImpactDays = Math.max(0, totalHours / (8 * Math.max(1, avgCrewSize)));

    // ── Critical path assessment ────────────────────────────────────
    // If schedule impact exceeds 10% of event duration, flag as critical path
    const criticalPathAffected = eventDurationDays > 0
      ? scheduleImpactDays / eventDurationDays > 0.1
      : scheduleImpactDays > 2;

    const impactPercentage = eventDurationDays > 0
      ? Math.round((scheduleImpactDays / eventDurationDays) * 100 * 10) / 10
      : 0;

    const result: ImpactResult = {
      schedule_impact_days: Math.round(scheduleImpactDays * 10) / 10,
      cost_impact: Math.round(totalCost * 100) / 100,
      resource_impact_hours: Math.round(totalHours * 10) / 10,
      critical_path_affected: criticalPathAffected,
      details: {
        new_activities: newActivities,
        modified_activities: modifiedActivities,
        removed_activities: removedActivities,
        new_workpacks: newWorkpacks,
        total_estimated_hours: totalHours,
        total_estimated_cost: totalCost,
        baseline_exists: !!baseline,
        event_duration_days: eventDurationDays,
        impact_percentage: impactPercentage,
      },
    };

    // ── Write impact results to scope change ────────────────────────
    await prisma.scheduleScopeChange.update({
      where: { id: scopeChangeId },
      data: {
        schedule_impact_days: result.schedule_impact_days,
        cost_impact: result.cost_impact,
        resource_impact_hours: result.resource_impact_hours,
        critical_path_affected: result.critical_path_affected,
        impact_analysis: result as any,
      },
    });

    return result;
  }
}
