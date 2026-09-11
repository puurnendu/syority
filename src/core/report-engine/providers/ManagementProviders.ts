/**
 * M7.6B — Management Data Providers
 *
 * 7 providers: executive_dashboard, kpi_dashboard, scurve,
 * spi, cpi, cost_summary, resource_summary.
 */

import { prisma } from '@/lib/prisma';
import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';

function scopeFilters(params: Record<string, any>) {
  const where: any = {};
  if (params.site) where.site_id = params.site;
  if (params.unit) where.unit_id = params.unit;
  if (params.event) where.event_id = params.event;
  return where;
}

// ─── EVM Authority Integration (M8.10) ───────────────────────────────────────
// M14 R2: Rewired to use M8.10 EVM authoritative engine.
import { loadEvmActivities, getCurrentBaseline, generateEventCurve } from '@/core/evm/EvmSnapshotService';
import { calculateEventEvm } from '@/core/evm/EvmCalculationService';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import { CONTROL_TOWER_RULES } from '@/core/control-tower/ControlTowerRules';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';

/**
 * Retrieves authoritative EVM metrics from M8.10.
 * If event is provided, fetches strictly for that event.
 * If cross-event (no event param), aggregates all active baselines.
 */
async function fetchAuthoritativeEvm(orgId: string, params: Record<string, any>) {
  let eventIds = params.event ? [params.event] : [];
  
  if (eventIds.length === 0) {
    // Cross-event aggregation: find all events for the org (or site if filtered)
    const where: any = { organization_id: orgId, deleted_at: null };
    if (params.site) where.site_id = params.site;
    const events = await prisma.event.findMany({ where, select: { id: true } });
    eventIds = events.map(e => e.id);
  }

  let totalBAC = 0, totalBCWS = 0, totalBCWP = 0, totalACWP = 0, totalCount = 0;
  const now = new Date();

  // If a single event is requested, we can use the authoritative summary directly
  if (eventIds.length === 1) {
    const eventId = eventIds[0];
    const baseline = await getCurrentBaseline(eventId, orgId);
    if (baseline) {
      const activities = await loadEvmActivities(eventId, orgId, baseline.id);
      const summary = calculateEventEvm(activities, eventId, baseline.id, now);
      return {
        BAC: summary.bac,
        BCWS: summary.pv,
        BCWP: summary.ev,
        ACWP: summary.ac,
        spi: summary.spi ?? 1,
        cpi: summary.cpi ?? 1,
        eac: summary.eac ?? summary.bac,
        SV: summary.sv,
        CV: summary.cv,
        activityCount: activities.length,
      };
    }
  }

  for (const eventId of eventIds) {
    const baseline = await getCurrentBaseline(eventId, orgId);
    if (!baseline) continue;

    const activities = await loadEvmActivities(eventId, orgId, baseline.id);
    const summary = calculateEventEvm(activities, eventId, baseline.id, now);
    
    totalBAC += summary.bac;
    totalBCWS += summary.pv;
    totalBCWP += summary.ev;
    totalACWP += summary.ac;
    totalCount += activities.length;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const spi = totalBCWS > 0 ? r2(totalBCWP / totalBCWS) : 1;
  const cpi = totalACWP > 0 ? r2(totalBCWP / totalACWP) : 1;
  const eac = cpi > 0 ? r2(totalBAC / cpi) : totalBAC;

  return {
    BAC: r2(totalBAC),
    BCWS: r2(totalBCWS),
    BCWP: r2(totalBCWP),
    ACWP: r2(totalACWP),
    spi,
    cpi,
    eac,
    SV: r2(totalBCWP - totalBCWS),
    CV: r2(totalBCWP - totalACWP),
    activityCount: totalCount,
  };
}

// ─── Providers ──────────────────────────────────────────────────────────────

export class ExecutiveDashboardProvider extends BaseProvider {
  readonly key = 'management.executive_dashboard';
  readonly category = 'management';
  readonly name = 'Executive Dashboard';
  readonly description = 'Earned Value Management metrics — SPI, CPI, BAC, EAC, variance analysis.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const evm = await fetchAuthoritativeEvm(ctx.organizationId, params);
    return {
      kpis: [
        { label: 'SPI', value: evm.spi, trend: evm.spi >= 1 ? 'up' as const : 'down' as const, color: evm.spi >= 1 ? '#059669' : '#DC2626' },
        { label: 'CPI', value: evm.cpi, trend: evm.cpi >= 1 ? 'up' as const : 'down' as const, color: evm.cpi >= 1 ? '#059669' : '#DC2626' },
        { label: 'BAC', value: evm.BAC, unit: '$' },
        { label: 'EAC', value: evm.eac, unit: '$' },
        { label: 'SV', value: evm.SV, unit: '$', color: evm.SV >= 0 ? '#059669' : '#DC2626' },
        { label: 'CV', value: evm.CV, unit: '$', color: evm.CV >= 0 ? '#059669' : '#DC2626' },
      ],
      summary: `Project EVM: SPI=${evm.spi}, CPI=${evm.cpi}. BAC=$${evm.BAC}, EAC=$${evm.eac}. SV=$${evm.SV}, CV=$${evm.CV}.`,
      rows: [
        { metric: 'BAC', value: evm.BAC }, { metric: 'BCWS', value: evm.BCWS },
        { metric: 'BCWP', value: evm.BCWP }, { metric: 'ACWP', value: evm.ACWP },
        { metric: 'SPI', value: evm.spi }, { metric: 'CPI', value: evm.cpi },
        { metric: 'EAC', value: evm.eac },
      ],
      metadata: { recordCount: evm.activityCount },
    };
  }
}

export class KpiDashboardProvider extends BaseProvider {
  readonly key = 'management.kpi_dashboard';
  readonly category = 'management';
  readonly name = 'KPI Dashboard';
  readonly description = 'Key Performance Indicators — workpack completion, activity status, punch items.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = params.event;
    if (eventId) {
      const [progress, wpCount, completedWp, punchCount] = await Promise.all([
        ProgressAggregationService.getEventProgress(ctx.organizationId, eventId),
        prisma.workpack.count({ where: { organization_id: ctx.organizationId, event_id: eventId, deleted_at: null } }).catch(() => 0),
        prisma.workpack.count({ where: { organization_id: ctx.organizationId, event_id: eventId, deleted_at: null, status: 'completed' } }).catch(() => 0),
        prisma.punchListItem.count({ where: { organization_id: ctx.organizationId, workpack: { event_id: eventId } } }).catch(() => 0),
      ]);
      return {
        kpis: [
          { label: 'Total Workpacks', value: wpCount },
          { label: 'Completed WP', value: completedWp, color: '#059669' },
          { label: 'Event Progress', value: `${progress.overall.weightedProgress}%` },
          { label: 'Total Activities', value: progress.overall.totalActivities },
          { label: 'Completed Act.', value: progress.overall.completedActivities, color: '#059669' },
          { label: 'Punch Items', value: punchCount, color: '#F59E0B' },
        ],
      };
    }

    const [wpCount, actCount, punchCount] = await Promise.all([
      prisma.workpack.count({ where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) } }),
      prisma.activity.count({ where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) } }),
      prisma.punchListItem.count({ where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) } }).catch(() => 0),
    ]);
    const completedWp = await prisma.workpack.count({ where: { organization_id: ctx.organizationId, deleted_at: null, status: 'completed', ...scopeFilters(params) } });
    const completedAct = await prisma.activity.count({ where: { organization_id: ctx.organizationId, deleted_at: null, status: 'completed', ...scopeFilters(params) } });
    return {
      kpis: [
        { label: 'Total Workpacks', value: wpCount },
        { label: 'Completed WP', value: completedWp, color: '#059669' },
        { label: 'Total Activities', value: actCount },
        { label: 'Completed Act.', value: completedAct, color: '#059669' },
        { label: 'Punch Items', value: punchCount, color: '#F59E0B' },
      ],
    };
  }
}

export class ScurveProvider extends BaseProvider {
  readonly key = 'management.scurve';
  readonly category = 'management';
  readonly name = 'S-Curve Report';
  readonly description = 'Planned vs Actual vs Earned value S-curve from M8.10 EVM authority.';
  readonly optionalParams = ['site', 'event', 'date_from', 'date_to'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = params.event ?? params.eventId;
    if (!eventId) {
      return { summary: 'S-Curve requires event parameter.', kpis: [{ label: 'S-Curve', value: 'Specify Event', unit: '' }] };
    }

    const fromDate = params.date_from ? new Date(params.date_from) : undefined;
    const toDate = params.date_to ? new Date(params.date_to) : undefined;
    const curveData = await generateEventCurve(eventId, ctx.organizationId, fromDate, toDate);

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
      eacProjection: curveData.eacProjection[idx],
    }));

    return {
      summary: `M8.10 Authoritative S-Curve: ${curveData.dates.length} points calculated.`,
      chartData: curveData,
      rows,
      kpis: [
        { label: 'Data Points', value: curveData.dates.length },
        { label: 'Final PV', value: curveData.pv[curveData.pv.length - 1] ?? 0, unit: '$' },
        { label: 'Current EV', value: curveData.ev[curveData.ev.length - 1] ?? 0, unit: '$' },
        { label: 'Current AC', value: curveData.ac[curveData.ac.length - 1] ?? 0, unit: '$' },
      ],
    };
  }
}

export class SpiTrendProvider extends BaseProvider {
  readonly key = 'management.spi';
  readonly category = 'management';
  readonly name = 'SPI Trend';
  readonly description = 'Schedule Performance Index trend.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const evm = await fetchAuthoritativeEvm(ctx.organizationId, params);
    return { kpis: [{ label: 'SPI', value: evm.spi, trend: evm.spi >= 1 ? 'up' as const : 'down' as const, color: evm.spi >= 1 ? '#059669' : '#DC2626' }], summary: `Schedule Performance Index: ${evm.spi}` };
  }
}

export class CpiTrendProvider extends BaseProvider {
  readonly key = 'management.cpi';
  readonly category = 'management';
  readonly name = 'CPI Trend';
  readonly description = 'Cost Performance Index trend.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const evm = await fetchAuthoritativeEvm(ctx.organizationId, params);
    return { kpis: [{ label: 'CPI', value: evm.cpi, trend: evm.cpi >= 1 ? 'up' as const : 'down' as const, color: evm.cpi >= 1 ? '#059669' : '#DC2626' }], summary: `Cost Performance Index: ${evm.cpi}` };
  }
}

export class CostSummaryProvider extends BaseProvider {
  readonly key = 'management.cost_summary';
  readonly category = 'management';
  readonly name = 'Cost Summary';
  readonly description = 'Cost breakdown — BAC, EAC, variance.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const evm = await fetchAuthoritativeEvm(ctx.organizationId, params);
    return {
      kpis: [
        { label: 'BAC', value: evm.BAC, unit: '$' },
        { label: 'EAC', value: evm.eac, unit: '$' },
        { label: 'CV', value: evm.CV, unit: '$', color: evm.CV >= 0 ? '#059669' : '#DC2626' },
      ],
      rows: [
        { metric: 'BAC', value: evm.BAC }, { metric: 'BCWS', value: evm.BCWS },
        { metric: 'BCWP', value: evm.BCWP }, { metric: 'ACWP', value: evm.ACWP },
        { metric: 'EAC', value: evm.eac },
      ],
    };
  }
}

export class ResourceSummaryProvider extends BaseProvider {
  readonly key = 'management.resource_summary';
  readonly category = 'management';
  readonly name = 'Resource Summary';
  readonly description = 'Resource allocation and utilization by type.';

  async fetch(ctx: ProviderContext, _params: Record<string, any>): Promise<DataFetcherResult> {
    const resources = await prisma.activityResource.findMany({
      where: { activity: { organization_id: ctx.organizationId, deleted_at: null } },
      select: { resource_name: true, resource_type: true, planned_hours: true, actual_hours: true },
    }).catch(() => []);
    const map = new Map<string, { planned: number; actual: number; count: number }>();
    (resources as any[]).forEach((r) => {
      const key = r.resource_type ?? 'Other';
      const cur = map.get(key) ?? { planned: 0, actual: 0, count: 0 };
      cur.planned += Number(r.planned_hours ?? 0); cur.actual += Number(r.actual_hours ?? 0); cur.count++;
      map.set(key, cur);
    });
    return {
      rows: Array.from(map.entries()).map(([type, v]) => ({
        type, count: v.count, planned_hours: v.planned, actual_hours: v.actual,
        utilization: v.planned > 0 ? `${Math.round(v.actual / v.planned * 100)}%` : '—',
      })),
      metadata: { recordCount: map.size },
    };
  }
}

export class ControlTowerExceptionsProvider extends BaseProvider {
  readonly key = 'management.control_tower_exceptions';
  readonly category = 'management';
  readonly name = 'Management Exceptions Report';
  readonly description = 'Predictive warnings, blockers, and operational anomalies from M13 Control Tower intelligence.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['site', 'priority', 'unit', 'area'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const summary = await ControlTowerQueryService.getSummary(ctx.organizationId, params.event);
    
    let exceptions = summary.exceptions;
    if (params.priority) {
      exceptions = exceptions.filter(e => e.severity === params.priority);
    }

    const rows = exceptions.map((e) => {
      const rule = CONTROL_TOWER_RULES[e.reason];
      const category = e.severity === 'P1' ? 'Critical Blocker'
        : e.severity === 'P2' ? 'High Risk'
        : e.severity === 'P3' ? 'Moderate Risk'
        : 'Operational Anomaly';

      const recommendedAction = e.severity === 'P1'
        ? 'Immediate intervention: Clear critical path constraints & assign emergency recovery resources.'
        : e.reason === 'READINESS_BLOCKED'
        ? 'Expedite prerequisite permit, isolation, or material clearance.'
        : e.reason === 'CONSTRAINT_BLOCKED'
        ? 'Escalate constraint owner to unblock execution.'
        : 'Monitor shift velocity and track float variance.';

      return {
        exception: rule?.description ?? e.reason,
        priority: e.severity,
        category,
        area: e.unitCode ? `Area ${e.unitCode}` : '—',
        unit: e.unitCode ?? '—',
        equipment: e.equipmentName ?? '—',
        workpack: e.workpackName ?? '—',
        activity: e.activityIdCode ?? e.activityId,
        owner: e.description ?? 'Turnaround Operations',
        status: e.status ?? 'Active',
        age: 'Active Shift',
        impact: `Float: ${e.totalFloat}d | SPI: ${e.spi ?? '—'} | Critical: ${e.isCritical ? 'Yes' : 'No'}`,
        recommended_action: recommendedAction,
      };
    });

    const p1Count = exceptions.filter(e => e.severity === 'P1').length;
    const p2Count = exceptions.filter(e => e.severity === 'P2').length;
    const p3Count = exceptions.filter(e => e.severity === 'P3').length;

    return {
      summary: `M13 Control Tower identified ${exceptions.length} exceptions (${p1Count} P1 critical, ${p2Count} P2 high risk).`,
      rows,
      kpis: [
        { label: 'Total Exceptions', value: exceptions.length, color: exceptions.length > 0 ? '#DC2626' : '#10B981' },
        { label: 'P1 Critical', value: p1Count, color: '#DC2626' },
        { label: 'P2 High Risk', value: p2Count, color: '#F59E0B' },
        { label: 'P3 Moderate', value: p3Count, color: '#3B82F6' },
      ],
      metadata: { recordCount: rows.length, calculatedAt: summary.calculatedAt },
    };
  }
}

export const managementProviders = [
  new ExecutiveDashboardProvider(),
  new KpiDashboardProvider(),
  new ScurveProvider(),
  new SpiTrendProvider(),
  new CpiTrendProvider(),
  new CostSummaryProvider(),
  new ResourceSummaryProvider(),
  new ControlTowerExceptionsProvider(),
];
