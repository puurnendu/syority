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

// ─── Internal EVM Computation ───────────────────────────────────────────────

async function computeEvm(orgId: string, params: Record<string, any>) {
  const activities = await prisma.activity.findMany({
    where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) },
    select: { progress_percent: true, budgeted_cost: true, actual_cost: true, early_start: true, early_finish: true, actual_start: true },
  });
  const now = new Date();
  const BAC = activities.reduce((s, a) => s + Number(a.budgeted_cost ?? 0), 0) || 1;
  const ACWP = activities.reduce((s, a) => a.actual_start ? s + Number(a.actual_cost ?? 0) : s, 0);
  const BCWP = activities.reduce((s, a) => s + Number(a.budgeted_cost ?? 0) * (Number(a.progress_percent ?? 0) / 100), 0);
  const BCWS = activities.reduce((s, a) => {
    if (!a.early_finish) return s;
    const fin = new Date(a.early_finish);
    const start = a.early_start ? new Date(a.early_start) : now;
    const dur = fin.getTime() - start.getTime();
    if (dur <= 0) return s + Number(a.budgeted_cost ?? 0);
    const frac = Math.min(1, (now.getTime() - start.getTime()) / dur);
    return s + Number(a.budgeted_cost ?? 0) * Math.max(0, frac);
  }, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const spi = BCWS > 0 ? r2(BCWP / BCWS) : 1;
  const cpi = ACWP > 0 ? r2(BCWP / ACWP) : 1;
  const eac = cpi > 0 ? r2(BAC / cpi) : BAC;
  return { BAC: r2(BAC), BCWS: r2(BCWS), BCWP: r2(BCWP), ACWP: r2(ACWP), spi, cpi, eac, SV: r2(BCWP - BCWS), CV: r2(BCWP - ACWP), activityCount: activities.length };
}

// ─── Providers ──────────────────────────────────────────────────────────────

export class ExecutiveDashboardProvider extends BaseProvider {
  readonly key = 'management.executive_dashboard';
  readonly category = 'management';
  readonly name = 'Executive Dashboard';
  readonly description = 'Earned Value Management metrics — SPI, CPI, BAC, EAC, variance analysis.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const evm = await computeEvm(ctx.organizationId, params);
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
    const [wpCount, actCount, punchCount] = await Promise.all([
      prisma.workpack.count({ where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) } }),
      prisma.activity.count({ where: { organization_id: ctx.organizationId, deleted_at: null } }),
      prisma.punchListItem.count({ where: { organization_id: ctx.organizationId, deleted_at: null } }).catch(() => 0),
    ]);
    const completedWp = await prisma.workpack.count({ where: { organization_id: ctx.organizationId, deleted_at: null, status: 'completed' } });
    const completedAct = await prisma.activity.count({ where: { organization_id: ctx.organizationId, deleted_at: null, status: 'completed' } });
    return {
      kpis: [
        { label: 'Total Workpacks', value: wpCount },
        { label: 'Completed WP', value: completedWp, color: '#059669' },
        { label: 'WP Completion', value: wpCount > 0 ? `${Math.round(completedWp / wpCount * 100)}` : '0', unit: '%' },
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
  readonly description = 'Planned vs Actual vs Earned value S-curve.';
  readonly optionalParams = ['site', 'event'];

  async fetch(_ctx: ProviderContext, _params: Record<string, any>): Promise<DataFetcherResult> {
    return { summary: 'S-Curve data available — renders as chart in report output.', kpis: [{ label: 'S-Curve', value: 'Chart', unit: '' }] };
  }
}

export class SpiTrendProvider extends BaseProvider {
  readonly key = 'management.spi';
  readonly category = 'management';
  readonly name = 'SPI Trend';
  readonly description = 'Schedule Performance Index trend.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const evm = await computeEvm(ctx.organizationId, params);
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
    const evm = await computeEvm(ctx.organizationId, params);
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
    const evm = await computeEvm(ctx.organizationId, params);
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

export const managementProviders = [
  new ExecutiveDashboardProvider(),
  new KpiDashboardProvider(),
  new ScurveProvider(),
  new SpiTrendProvider(),
  new CpiTrendProvider(),
  new CostSummaryProvider(),
  new ResourceSummaryProvider(),
];
