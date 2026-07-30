/**
 * M7.6D — Planning Intelligence Providers
 *
 * 22 providers consuming existing PlannerWorkspaceService, RollupEngine,
 * ValidationEngineService. Zero new business logic — data flows through
 * established services only.
 */

import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';
import { prisma } from '@/lib/prisma';
import { RollupEngine } from '@/core/planner-workspace/RollupEngine';
import { ValidationEngineService } from '@/core/planner-workspace/ValidationEngineService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function eventScope(params: Record<string, any>) {
  const where: any = { deleted_at: null };
  if (params.event) where.event_id = params.event;
  if (params.site) where.site_id = params.site;
  if (params.unit) where.unit_id = params.unit;
  if (params.contractor) where.contractor_id = params.contractor;
  if (params.discipline) where.discipline_id = params.discipline;
  return where;
}

// ─── Providers ──────────────────────────────────────────────────────────────

export class CriticalActivitiesProvider extends BaseProvider {
  readonly key = 'planning.critical_activities';
  readonly category = 'planning';
  readonly name = 'Critical Activities';
  readonly description = 'All activities on the critical path.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, is_critical: true, actual_end: null, ...eventScope(params) },
      select: { activity_number: true, description: true, status: true, early_start: true, early_finish: true, total_float: true, responsible: true, workpack: { select: { title: true, workpack_number: true } } },
      orderBy: { early_start: 'asc' },
    });
    return { rows: activities, kpis: [{ label: 'Critical Activities', value: activities.length, color: '#DC2626' }] };
  }
}

export class NearCriticalPathProvider extends BaseProvider {
  readonly key = 'planning.near_critical_path';
  readonly category = 'planning';
  readonly name = 'Near Critical Path';
  readonly description = 'Activities with total float ≤ 5 days (not critical).';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const threshold = params.floatThreshold ?? 5;
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, is_critical: false, actual_end: null, total_float: { lte: threshold }, ...eventScope(params) },
      select: { activity_number: true, description: true, status: true, total_float: true, early_start: true, early_finish: true, responsible: true },
      orderBy: { total_float: 'asc' },
    });
    return { rows: activities, kpis: [{ label: 'Near Critical', value: activities.length, color: '#F59E0B' }] };
  }
}

export class LogicHealthProvider extends BaseProvider {
  readonly key = 'planning.logic_health';
  readonly category = 'planning';
  readonly name = 'Logic Health';
  readonly description = 'Schedule logic validation summary.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const issues = await ValidationEngineService.validate({ organizationId: ctx.organizationId, eventId: params.event });
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const infos = issues.filter((i) => i.severity === 'info').length;
    return {
      kpis: [
        { label: 'Errors', value: errors, color: '#DC2626' },
        { label: 'Warnings', value: warnings, color: '#F59E0B' },
        { label: 'Info', value: infos, color: '#3B82F6' },
        { label: 'Total Issues', value: issues.length },
      ],
      rows: issues.slice(0, 100),
    };
  }
}

export class RelationshipErrorsProvider extends BaseProvider {
  readonly key = 'planning.relationship_errors';
  readonly category = 'planning';
  readonly name = 'Relationship Errors';
  readonly description = 'Missing or circular relationship validation issues.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const issues = await ValidationEngineService.validate({ organizationId: ctx.organizationId, eventId: params.event });
    const relIssues = issues.filter((i) => ['V2', 'V3', 'V4', 'V14'].includes(i.ruleId));
    return { rows: relIssues, kpis: [{ label: 'Relationship Issues', value: relIssues.length, color: relIssues.length > 0 ? '#DC2626' : '#10B981' }] };
  }
}

export class ConstraintViolationsProvider extends BaseProvider {
  readonly key = 'planning.constraint_violations';
  readonly category = 'planning';
  readonly name = 'Constraint Violations';
  readonly description = 'Open and violated constraints from ValidationEngine.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const issues = await ValidationEngineService.validate({ organizationId: ctx.organizationId, eventId: params.event });
    const constraintIssues = issues.filter((i) => ['V5', 'V6', 'V15'].includes(i.ruleId));
    return { rows: constraintIssues, kpis: [{ label: 'Constraint Violations', value: constraintIssues.length, color: constraintIssues.length > 0 ? '#F59E0B' : '#10B981' }] };
  }
}

export class FloatDistributionProvider extends BaseProvider {
  readonly key = 'planning.float_distribution';
  readonly category = 'planning';
  readonly name = 'Float Distribution';
  readonly description = 'Distribution of total float across all activities.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, actual_end: null, ...eventScope(params) },
      select: { total_float: true },
    });
    const buckets = { negative: 0, zero: 0, low: 0, medium: 0, high: 0 };
    for (const a of activities) {
      const f = a.total_float ?? 0;
      if (f < 0) buckets.negative++;
      else if (f === 0) buckets.zero++;
      else if (f <= 5) buckets.low++;
      else if (f <= 20) buckets.medium++;
      else buckets.high++;
    }
    return {
      rows: [
        { bucket: 'Negative', count: buckets.negative, color: '#DC2626' },
        { bucket: 'Zero', count: buckets.zero, color: '#F97316' },
        { bucket: '1–5 days', count: buckets.low, color: '#F59E0B' },
        { bucket: '6–20 days', count: buckets.medium, color: '#3B82F6' },
        { bucket: '20+ days', count: buckets.high, color: '#10B981' },
      ],
      kpis: [{ label: 'Avg Float', value: activities.length > 0 ? Math.round(activities.reduce((s, a) => s + (a.total_float ?? 0), 0) / activities.length) : 0, unit: 'days' }],
    };
  }
}

export class LateActivitiesProvider extends BaseProvider {
  readonly key = 'planning.late_activities';
  readonly category = 'planning';
  readonly name = 'Late Activities';
  readonly description = 'Activities past their early finish date that are not complete.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const now = new Date();
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, actual_end: null, early_finish: { lt: now }, ...eventScope(params) },
      select: { activity_number: true, description: true, early_finish: true, total_float: true, responsible: true, workpack: { select: { title: true } } },
      orderBy: { early_finish: 'asc' },
    });
    return { rows: activities, kpis: [{ label: 'Late Activities', value: activities.length, color: '#DC2626' }] };
  }
}

export class MilestoneTrackerProvider extends BaseProvider {
  readonly key = 'planning.milestone_tracker';
  readonly category = 'planning';
  readonly name = 'Milestone Tracker';
  readonly description = 'Key project milestones with status.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const milestones = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, is_milestone: true, ...eventScope(params) },
      select: { activity_number: true, description: true, status: true, early_start: true, early_finish: true, actual_start: true, actual_end: true, is_critical: true },
      orderBy: { early_finish: 'asc' },
    });
    const completed = milestones.filter((m) => m.actual_end !== null).length;
    return { rows: milestones, kpis: [{ label: 'Total Milestones', value: milestones.length }, { label: 'Completed', value: completed, color: '#10B981' }, { label: 'Remaining', value: milestones.length - completed }] };
  }
}

export class SchedulePerformanceProvider extends BaseProvider {
  readonly key = 'planning.schedule_performance';
  readonly category = 'planning';
  readonly name = 'Schedule Performance';
  readonly description = 'Schedule performance via RollupEngine.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const rollups = await RollupEngine.computeEventRollups(ctx.organizationId, params.event);
    const total = rollups.event.activityCount;
    const completedCount = await prisma.activity.count({ where: { organization_id: ctx.organizationId, event_id: params.event, actual_end: { not: null }, deleted_at: null } });
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    return {
      kpis: [
        { label: 'Activities', value: total },
        { label: 'Completed', value: completedCount, color: '#10B981' },
        { label: 'Completion %', value: `${pct}%`, color: pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#DC2626' },
        { label: 'Workpacks', value: rollups.event.workpackCount },
      ],
    };
  }
}

export class BaselineVsCurrentProvider extends BaseProvider {
  readonly key = 'planning.baseline_vs_current';
  readonly category = 'planning';
  readonly name = 'Baseline vs Current';
  readonly description = 'Baseline vs current schedule dates for activities.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      select: { activity_number: true, description: true, early_start: true, early_finish: true, baseline_start: true, baseline_finish: true, total_float: true },
      take: 200,
      orderBy: { early_start: 'asc' },
    });
    return { rows: activities };
  }
}

export class SCurveProvider extends BaseProvider {
  readonly key = 'planning.scurve';
  readonly category = 'planning';
  readonly name = 'S-Curve';
  readonly description = 'Cumulative progress S-Curve data.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const rollups = await RollupEngine.computeEventRollups(ctx.organizationId, params.event);
    return {
      kpis: [
        { label: 'Total Activities', value: rollups.event.activityCount },
        { label: 'Total Manhours', value: Math.round(rollups.event.totalResourceHrs), unit: 'hrs' },
      ],
      metadata: { rollup: rollups },
    };
  }
}

export class EarnedValueProvider extends BaseProvider {
  readonly key = 'planning.earned_value';
  readonly category = 'planning';
  readonly name = 'Earned Value Management';
  readonly description = 'EVM metrics from RollupEngine.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const rollups = await RollupEngine.computeEventRollups(ctx.organizationId, params.event);
    return {
      kpis: [
        { label: 'Planned Duration', value: Math.round(rollups.event.totalDurationHrs), unit: 'hrs' },
        { label: 'Resource Hours', value: Math.round(rollups.event.totalResourceHrs), unit: 'hrs' },
        { label: 'Avg Readiness', value: `${Math.round(rollups.event.avgReadiness)}%` },
      ],
    };
  }
}

export class ScheduleHealthIndexProvider extends BaseProvider {
  readonly key = 'planning.schedule_health_index';
  readonly category = 'planning';
  readonly name = 'Schedule Health Index';
  readonly description = 'Composite health score from ValidationEngine.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const issues = await ValidationEngineService.validate({ organizationId: ctx.organizationId, eventId: params.event });
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const score = Math.max(0, 100 - (errors * 5) - (warnings * 2));
    return {
      kpis: [
        { label: 'Health Score', value: score, unit: '%', color: score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#DC2626' },
        { label: 'Errors', value: errors, color: '#DC2626' },
        { label: 'Warnings', value: warnings, color: '#F59E0B' },
      ],
    };
  }
}

export class ActivityStatusSummaryProvider extends BaseProvider {
  readonly key = 'planning.activity_status_summary';
  readonly category = 'planning';
  readonly name = 'Activity Status Summary';
  readonly description = 'Breakdown of activities by status.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.groupBy({
      by: ['status'],
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      _count: { id: true },
    });
    return {
      rows: activities.map((a) => ({ status: a.status, count: a._count.id })),
      kpis: activities.map((a) => ({ label: a.status ?? 'Unknown', value: a._count.id })),
    };
  }
}

export class OpenConstraintsProvider extends BaseProvider {
  readonly key = 'planning.open_constraints';
  readonly category = 'planning';
  readonly name = 'Open Constraints';
  readonly description = 'Unresolved constraints.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const constraints = await prisma.constraint.findMany({
      where: { organization_id: ctx.organizationId, event_id: params.event, status: { not: 'resolved' }, deleted_at: null },
      select: { id: true, title: true, description: true, status: true, severity: true, due_date: true, responsible: true },
      orderBy: { due_date: 'asc' },
    });
    return { rows: constraints, kpis: [{ label: 'Open Constraints', value: constraints.length, color: constraints.length > 5 ? '#DC2626' : '#F59E0B' }] };
  }
}

export class UpcomingMilestonesProvider extends BaseProvider {
  readonly key = 'planning.upcoming_milestones';
  readonly category = 'planning';
  readonly name = 'Upcoming Milestones';
  readonly description = 'Milestones due in the next 14 days.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const now = new Date();
    const in14d = new Date(now.getTime() + 14 * 24 * 3600_000);
    const milestones = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, is_milestone: true, actual_end: null, early_finish: { gte: now, lte: in14d }, ...eventScope(params) },
      select: { activity_number: true, description: true, early_finish: true, is_critical: true },
      orderBy: { early_finish: 'asc' },
    });
    return { rows: milestones, kpis: [{ label: 'Upcoming (14d)', value: milestones.length }] };
  }
}

export class PlannerProductivityProvider extends BaseProvider {
  readonly key = 'planning.planner_productivity';
  readonly category = 'planning';
  readonly name = 'Planner Productivity';
  readonly description = 'Workpacks and activities per planner.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const planners = await prisma.workpack.groupBy({
      by: ['assigned_planner_id'],
      where: { organization_id: ctx.organizationId, event_id: params.event, deleted_at: null },
      _count: { id: true },
    });
    return { rows: planners.map((p) => ({ plannerId: p.assigned_planner_id, workpackCount: p._count.id })) };
  }
}

export class ReadyWorkpacksProvider extends BaseProvider {
  readonly key = 'planning.ready_workpacks';
  readonly category = 'planning';
  readonly name = 'Ready Workpacks';
  readonly description = 'Workpacks with readiness ≥ 100%.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const wps = await prisma.workpack.findMany({
      where: { organization_id: ctx.organizationId, event_id: params.event, deleted_at: null, readiness_pct: { gte: 100 } },
      select: { workpack_number: true, title: true, readiness_pct: true, status: true },
      orderBy: { workpack_number: 'asc' },
    });
    return { rows: wps, kpis: [{ label: 'Ready', value: wps.length, color: '#10B981' }] };
  }
}

export class WaitingWorkpacksProvider extends BaseProvider {
  readonly key = 'planning.waiting_workpacks';
  readonly category = 'planning';
  readonly name = 'Waiting Workpacks';
  readonly description = 'Workpacks awaiting readiness or approval.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const wps = await prisma.workpack.findMany({
      where: { organization_id: ctx.organizationId, event_id: params.event, deleted_at: null, readiness_pct: { lt: 100 }, status: { in: ['draft', 'pending'] } },
      select: { workpack_number: true, title: true, readiness_pct: true, status: true },
      orderBy: { readiness_pct: 'desc' },
    });
    return { rows: wps, kpis: [{ label: 'Waiting', value: wps.length, color: '#F59E0B' }] };
  }
}

export class UnassignedWorkProvider extends BaseProvider {
  readonly key = 'planning.unassigned_work';
  readonly category = 'planning';
  readonly name = 'Unassigned Work';
  readonly description = 'Activities without a responsible party.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, actual_end: null, responsible: null, ...eventScope(params) },
      select: { activity_number: true, description: true, status: true, early_start: true },
      orderBy: { early_start: 'asc' },
    });
    return { rows: activities, kpis: [{ label: 'Unassigned', value: activities.length, color: activities.length > 0 ? '#F59E0B' : '#10B981' }] };
  }
}

export class ResourceLoadingProvider extends BaseProvider {
  readonly key = 'planning.resource_loading';
  readonly category = 'planning';
  readonly name = 'Resource Loading';
  readonly description = 'Crew and resource hours from RollupEngine.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const rollups = await RollupEngine.computeEventRollups(ctx.organizationId, params.event);
    return {
      rows: rollups.units.map((u) => ({
        unit: u.entityName,
        crew: u.values.totalCrew,
        resourceHrs: Math.round(u.values.totalResourceHrs),
        activities: u.values.activityCount,
        workpacks: u.values.workpackCount,
      })),
      kpis: [
        { label: 'Total Crew', value: rollups.event.totalCrew },
        { label: 'Resource Hours', value: Math.round(rollups.event.totalResourceHrs), unit: 'hrs' },
      ],
    };
  }
}

export class CalendarExceptionsProvider extends BaseProvider {
  readonly key = 'planning.calendar_exceptions';
  readonly category = 'planning';
  readonly name = 'Calendar Exceptions';
  readonly description = 'Non-working days and calendar exceptions.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const exceptions = await prisma.calendar_exception.findMany({
      where: { organization_id: ctx.organizationId, event_id: params.event },
      select: { id: true, title: true, exception_date: true, is_working: true, description: true },
      orderBy: { exception_date: 'asc' },
    });
    return { rows: exceptions, kpis: [{ label: 'Exceptions', value: exceptions.length }] };
  }
}

// ─── Export All ──────────────────────────────────────────────────────────────

export const planningIntelligenceProviders = [
  new CriticalActivitiesProvider(),
  new NearCriticalPathProvider(),
  new LogicHealthProvider(),
  new RelationshipErrorsProvider(),
  new ConstraintViolationsProvider(),
  new FloatDistributionProvider(),
  new LateActivitiesProvider(),
  new MilestoneTrackerProvider(),
  new SchedulePerformanceProvider(),
  new BaselineVsCurrentProvider(),
  new SCurveProvider(),
  new EarnedValueProvider(),
  new ScheduleHealthIndexProvider(),
  new ActivityStatusSummaryProvider(),
  new OpenConstraintsProvider(),
  new UpcomingMilestonesProvider(),
  new PlannerProductivityProvider(),
  new ReadyWorkpacksProvider(),
  new WaitingWorkpacksProvider(),
  new UnassignedWorkProvider(),
  new ResourceLoadingProvider(),
  new CalendarExceptionsProvider(),
];
