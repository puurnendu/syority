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
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';
import { PlanningReadinessService } from '@/core/planning/PlanningReadinessService';
import { loadEvmActivities, getCurrentBaseline, generateEventCurve } from '@/core/evm/EvmSnapshotService';
import { calculateEventEvm } from '@/core/evm/EvmCalculationService';
import { milestoneWhere } from '@/core/activity/milestoneDerivation';

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
  readonly name = 'Critical Activities Report';
  readonly description = 'Strict tracking of CPM critical path activities and float from M11 schedule authority.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['site', 'unit', 'contractor', 'discipline', 'workpack'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: {
        organization_id: ctx.organizationId,
        is_critical: true,
        ...eventScope(params),
      },
      include: {
        workpack: {
          select: {
            id: true,
            workpack_number: true,
            title: true,
            asset: { select: { tag_number: true, name: true } },
          },
        },
      },
      orderBy: [{ planned_start: 'asc' }, { sequence_number: 'asc' }],
    });

    const rows = activities.map((a: any) => ({
      activity: a.activity_number ?? a.activity_id ?? a.id,
      description: a.description,
      equipment: a.workpack?.asset?.tag_number ?? a.workpack?.asset?.name ?? '—',
      workpack: a.workpack?.workpack_number ?? a.workpack?.title ?? '—',
      planned_start: a.planned_start ? a.planned_start.toISOString().split('T')[0] : (a.early_start ? a.early_start.toISOString().split('T')[0] : '—'),
      planned_finish: a.planned_end ? a.planned_end.toISOString().split('T')[0] : (a.early_finish ? a.early_finish.toISOString().split('T')[0] : '—'),
      actual_start: a.actual_start ? a.actual_start.toISOString().split('T')[0] : '—',
      actual_finish: a.actual_end ? a.actual_end.toISOString().split('T')[0] : '—',
      total_float: a.total_float != null ? Number(a.total_float) : 0,
      critical_flag: Boolean(a.is_critical),
      status: a.status,
      progress: `${a.progress_percent ?? 0}%`,
      constraint: a.constraint_status ?? (a.total_float != null && Number(a.total_float) <= 0 ? 'Critical Path' : 'None'),
    }));

    return {
      rows,
      kpis: [
        { label: 'Critical Activities', value: activities.length, color: '#DC2626' },
        { label: 'Completed', value: activities.filter((a: any) => a.status === 'completed').length, color: '#10B981' },
        { label: 'In Progress', value: activities.filter((a: any) => a.status === 'in_progress').length, color: '#3B82F6' },
        { label: 'Not Started', value: activities.filter((a: any) => a.status === 'not_started' || !a.status).length, color: '#F59E0B' },
      ],
      metadata: { recordCount: activities.length },
    };
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
  readonly description = 'Activities past their planned finish date that are delayed, from M12 FieldExecutionService.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const pva = await FieldExecutionService.getPlanVsActual(ctx.organizationId, params.event);
    const lateActivities = pva.filter((item) => item.is_delayed);
    const rows = lateActivities.map((d) => ({
      activity_number: d.activity_number ?? d.id,
      description: d.description,
      planned_finish: d.planned_end,
      actual_finish: d.actual_end,
      total_float: d.total_float ?? null,
      status: d.status,
      days_late: d.finish_variance_hours !== null ? Math.ceil(d.finish_variance_hours / 24) : null,
      workpack: d.workpack_number ?? '—',
    }));
    return {
      rows,
      kpis: [{ label: 'Late Activities', value: lateActivities.length, color: lateActivities.length > 0 ? '#DC2626' : '#10B981' }],
    };
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
      where: { organization_id: ctx.organizationId, ...eventScope(params), ...milestoneWhere() },
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
  readonly description = 'Schedule performance from M8.13 ProgressAggregationService.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const [progressData, rollups] = await Promise.all([
      ProgressAggregationService.getEventProgress(ctx.organizationId, params.event),
      RollupEngine.computeEventRollups(ctx.organizationId, params.event),
    ]);
    const total = progressData.overall.totalActivities;
    const completedCount = progressData.overall.completedActivities;
    const pct = progressData.overall.weightedProgress;
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
  readonly description = 'Cumulative progress S-Curve data from M8.10 EVM authority.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const curveData = await generateEventCurve(params.event, ctx.organizationId);
    if (!curveData) {
      return {
        summary: 'No EVM baseline found for S-Curve calculation.',
        kpis: [{ label: 'Baseline', value: 'None Active' }],
        rows: [],
      };
    }
    const rows = curveData.dates.map((date, idx) => ({
      date,
      pv: curveData.pv[idx],
      ev: curveData.ev[idx],
      ac: curveData.ac[idx],
    }));
    return {
      kpis: [
        { label: 'Data Points', value: curveData.dates.length },
        { label: 'Final PV', value: curveData.pv[curveData.pv.length - 1] ?? 0, unit: '$' },
        { label: 'Current EV', value: curveData.ev[curveData.ev.length - 1] ?? 0, unit: '$' },
      ],
      chartData: curveData,
      rows,
    };
  }
}

export class EarnedValueProvider extends BaseProvider {
  readonly key = 'planning.earned_value';
  readonly category = 'planning';
  readonly name = 'Earned Value Management';
  readonly description = 'Authoritative EVM metrics from M8.10 EvmCalculationService.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const baseline = await getCurrentBaseline(params.event, ctx.organizationId);
    if (!baseline) {
      return {
        kpis: [{ label: 'Baseline', value: 'None Active' }],
        rows: [],
      };
    }
    const activities = await loadEvmActivities(params.event, ctx.organizationId, baseline.id);
    const summary = calculateEventEvm(activities, params.event, baseline.id, new Date());
    return {
      kpis: [
        { label: 'BAC', value: summary.bac, unit: '$' },
        { label: 'PV', value: summary.pv, unit: '$' },
        { label: 'EV', value: summary.ev, unit: '$' },
        { label: 'AC', value: summary.ac, unit: '$' },
        { label: 'SPI', value: summary.spi ?? 1, color: (summary.spi ?? 1) >= 1 ? '#10B981' : '#DC2626' },
        { label: 'CPI', value: summary.cpi ?? 1, color: (summary.cpi ?? 1) >= 1 ? '#10B981' : '#DC2626' },
      ],
      rows: [
        { metric: 'BAC', value: summary.bac },
        { metric: 'PV', value: summary.pv },
        { metric: 'EV', value: summary.ev },
        { metric: 'AC', value: summary.ac },
        { metric: 'CV', value: summary.cv },
        { metric: 'SV', value: summary.sv },
        { metric: 'SPI', value: summary.spi },
        { metric: 'CPI', value: summary.cpi },
        { metric: 'EAC', value: summary.eac },
      ],
    };
  }
}

export class ScheduleHealthIndexProvider extends BaseProvider {
  readonly key = 'planning.schedule_health_index';
  readonly category = 'planning';
  readonly name = 'Schedule Health Index';
  readonly description = 'Schedule validation issue counts from ValidationEngineService.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const issues = await ValidationEngineService.validate({ organizationId: ctx.organizationId, eventId: params.event });
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const infos = issues.filter((i) => i.severity === 'info').length;
    return {
      kpis: [
        { label: 'Validation Issues', value: issues.length, color: errors > 0 ? '#DC2626' : warnings > 0 ? '#F59E0B' : '#10B981' },
        { label: 'Errors', value: errors, color: errors > 0 ? '#DC2626' : '#10B981' },
        { label: 'Warnings', value: warnings, color: '#F59E0B' },
        { label: 'Info', value: infos, color: '#3B82F6' },
      ],
      rows: issues.slice(0, 100),
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
      where: { organization_id: ctx.organizationId, actual_end: null, early_finish: { gte: now, lte: in14d }, ...eventScope(params), ...milestoneWhere() },
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
  readonly description = 'Workpacks with readiness ≥ 100% from M10 PlanningReadinessService.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const res = await PlanningReadinessService.getReadiness(ctx.organizationId, { event_id: params.event });
    const ready = res.workpacks.filter((w) => w.readiness_score >= 100 || w.planning_state === 'READY');
    return {
      rows: ready.map((w) => ({
        workpack_number: w.workpack_number ?? '—',
        title: w.title,
        readiness_pct: w.readiness_score,
        status: w.status,
      })),
      kpis: [{ label: 'Ready', value: ready.length, color: '#10B981' }],
    };
  }
}

export class WaitingWorkpacksProvider extends BaseProvider {
  readonly key = 'planning.waiting_workpacks';
  readonly category = 'planning';
  readonly name = 'Waiting Workpacks';
  readonly description = 'Workpacks awaiting readiness or approval from M10 PlanningReadinessService.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const res = await PlanningReadinessService.getReadiness(ctx.organizationId, { event_id: params.event });
    const waiting = res.workpacks.filter((w) => w.readiness_score < 100 && w.planning_state !== 'READY');
    return {
      rows: waiting.map((w) => ({
        workpack_number: w.workpack_number ?? '—',
        title: w.title,
        readiness_pct: w.readiness_score,
        status: w.status,
      })),
      kpis: [{ label: 'Waiting', value: waiting.length, color: '#F59E0B' }],
    };
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

function renderProgressBar(pct: number): string {
  const filled = Math.min(10, Math.max(0, Math.round(pct / 10)));
  const empty = 10 - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}

export class IdenticalActivitiesProvider extends BaseProvider {
  readonly key = 'planning.identical_activities';
  readonly category = 'planning';
  readonly name = 'Identical Activities Report';
  readonly description = 'Standard activity intelligence across repeating equipment types from M8.13 authority.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['site', 'unit', 'system', 'equipment_type', 'contractor', 'discipline'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const identicalGroups = await ProgressAggregationService.getIdenticalActivityProgress(
      ctx.organizationId,
      params.event,
      params.equipment_type
    );

    const rows = identicalGroups.map((group: any) => {
      const activityName = group.standardActivityTypeName ?? group.activityType ?? 'Standard Activity';
      const totalUnits = group.totalInstances ?? group.totalActivities ?? 0;
      const completedUnits = group.completedInstances ?? group.completedActivities ?? 0;
      const progressPct = group.completionPercent ?? group.progressPercent ?? 0;
      const balancePct = group.balancePercent ?? Math.max(0, 100 - progressPct);
      const remainingQty = Math.max(0, totalUnits - completedUnits);
      const totalDuration = group.metrics?.totalDurationHours ?? group.totalDurationHours ?? 0;
      const completedDuration = group.metrics?.completedDurationHours ?? group.completedDurationHours ?? 0;
      const bar = renderProgressBar(progressPct);
      return {
        standard_activity: activityName,
        equipment_type: group.equipmentType,
        planned_quantity: totalUnits,
        completed_quantity: completedUnits,
        progress_percent: `${progressPct}%`,
        balance: `Balance ${balancePct}% (Remaining: ${remainingQty})`,
        progress_visualization: `${bar} ${progressPct}% (Balance ${balancePct}%)`,
        planned_duration_hours: totalDuration,
        completed_duration_hours: completedDuration,
      };
    });

    const totalPlanned = identicalGroups.reduce((acc: number, g: any) => acc + (g.totalInstances ?? g.totalActivities ?? 0), 0);
    const totalCompleted = identicalGroups.reduce((acc: number, g: any) => acc + (g.completedInstances ?? g.completedActivities ?? 0), 0);
    const avgProgress = identicalGroups.length > 0
      ? Math.round(identicalGroups.reduce((acc: number, g: any) => acc + (g.completionPercent ?? g.progressPercent ?? 0), 0) / identicalGroups.length)
      : 0;

    return {
      summary: `Identical activity progress across ${identicalGroups.length} standard activity groups from M8.13 intelligence.`,
      rows,
      kpis: [
        { label: 'Activity Groups', value: identicalGroups.length },
        { label: 'Total Planned Units', value: totalPlanned },
        { label: 'Total Completed Units', value: totalCompleted, color: '#10B981' },
        { label: 'Average Progress', value: `${avgProgress}%`, color: avgProgress >= 75 ? '#10B981' : avgProgress >= 40 ? '#F59E0B' : '#DC2626' },
      ],
      metadata: { recordCount: rows.length },
    };
  }
}

export class PlanVsActualProvider extends BaseProvider {
  readonly key = 'planning.plan_vs_actual';
  readonly category = 'planning';
  readonly name = 'Plan vs Actual Report';
  readonly description = 'Direct execution schedule variance against baseline from M11, M12, and M8.13 authoritative data.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['site', 'unit', 'discipline', 'contractor', 'workpack'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const pva = await FieldExecutionService.getPlanVsActual(ctx.organizationId, params.event);

    let items = pva;
    if (params.discipline) {
      items = items.filter(i => i.discipline_name === params.discipline);
    }
    if (params.workpack) {
      items = items.filter(i => i.workpack_id === params.workpack || i.workpack_number === params.workpack);
    }

    const rows = items.map((i) => {
      const varStr = i.finish_variance_hours !== null
        ? `${Math.round(i.finish_variance_hours)}h (${Math.ceil(i.finish_variance_hours / 24)}d)`
        : '0h';
      return {
        activity: i.activity_number ?? i.id,
        description: i.description,
        equipment: '—',
        workpack: i.workpack_number ?? '—',
        planned_start: i.planned_start ?? '—',
        planned_finish: i.planned_end ?? '—',
        actual_start: i.actual_start ?? '—',
        actual_finish: i.actual_end ?? '—',
        variance: varStr,
        progress: `${i.progress_percent}%`,
        status: i.status,
        criticality: i.is_critical ? 'Critical' : 'Non-Critical',
        delay: i.is_delayed ? 'Delayed' : 'On Track',
      };
    });

    const delayedCount = items.filter(i => i.is_delayed).length;
    const criticalCount = items.filter(i => i.is_critical).length;
    const completedCount = items.filter(i => i.status === 'completed').length;

    return {
      summary: `Plan vs Actual variance for ${items.length} activities via M12 execution facts.`,
      rows,
      kpis: [
        { label: 'Total Activities', value: items.length },
        { label: 'Delayed Activities', value: delayedCount, color: delayedCount > 0 ? '#DC2626' : '#10B981' },
        { label: 'Critical Path Items', value: criticalCount, color: '#F59E0B' },
        { label: 'Completed', value: completedCount, color: '#10B981' },
      ],
      metadata: { recordCount: items.length },
    };
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
  new IdenticalActivitiesProvider(),
  new PlanVsActualProvider(),
];
