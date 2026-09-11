/**
 * M7.6B — Shutdown Data Providers
 *
 * 7 providers: scope_register, scope_change_register, deferred_scope,
 * workpack_status, unit_progress, contractor_progress, discipline_progress.
 */

import { prisma } from '@/lib/prisma';
import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';

function scopeFilters(params: Record<string, any>) {
  const where: any = {};
  if (params.site) where.site_id = params.site;
  if (params.unit) where.unit_id = params.unit;
  if (params.event) where.event_id = params.event;
  if (params.contractor) where.contractor_id = params.contractor;
  if (params.discipline) where.discipline_id = params.discipline;
  return where;
}

export class ScopeRegisterProvider extends BaseProvider {
  readonly key = 'shutdown.scope_register';
  readonly category = 'shutdown';
  readonly name = 'Scope Register';
  readonly description = 'Complete scope register with all items, status, and estimated hours.';
  readonly optionalParams = ['scope_id', 'discipline', 'priority'];
  readonly maxRows = 500;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const items = await (prisma.scopeItem as any).findMany({
      where: { organization_id: ctx.organizationId, scope: params.scope_id ? { id: params.scope_id } : undefined },
      select: { tag_number: true, asset_name: true, discipline: true, work_description: true, status: true, estimated_hours: true, priority: true },
      orderBy: { tag_number: 'asc' }, take: this.maxRows,
    }).catch(() => []);
    return {
      rows: items.map((i: any) => ({
        tag: i.tag_number ?? '—', asset: i.asset_name ?? '—', discipline: i.discipline ?? '—',
        work: i.work_description ?? '—', status: i.status, hours: i.estimated_hours ?? 0, priority: i.priority ?? '—',
      })),
      kpis: [
        { label: 'Scope Items', value: items.length },
        { label: 'Est. Hours', value: items.reduce((s: number, i: any) => s + (i.estimated_hours ?? 0), 0) },
      ],
      metadata: { recordCount: items.length },
    };
  }
}

export class ScopeChangeRegisterProvider extends BaseProvider {
  readonly key = 'shutdown.scope_change_register';
  readonly category = 'shutdown';
  readonly name = 'Scope Change Register';
  readonly description = 'All scope change requests with approval status.';
  readonly optionalParams = ['scope_id', 'status'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const changes = await prisma.scopeChangeRequest.findMany({
      where: { organization_id: ctx.organizationId, ...(params.scope_id ? { scope_id: params.scope_id } : {}) },
      select: { title: true, change_type: true, status: true, reason: true, estimated_hours: true, submitted_at: true, priority: true },
      orderBy: { submitted_at: 'desc' },
    }).catch(() => []);
    return {
      rows: changes.map((c: any) => ({
        title: c.title, type: c.change_type, status: c.status, reason: c.reason?.slice(0, 80) ?? '—',
        hours: c.estimated_hours ?? '—', submitted: c.submitted_at?.toISOString().split('T')[0] ?? '—',
      })),
      kpis: [
        { label: 'Change Requests', value: changes.length },
        { label: 'Pending', value: changes.filter((c: any) => c.status === 'pending').length, color: '#F59E0B' },
        { label: 'Approved', value: changes.filter((c: any) => c.status === 'approved').length, color: '#059669' },
      ],
      metadata: { recordCount: changes.length },
    };
  }
}

export class DeferredScopeProvider extends BaseProvider {
  readonly key = 'shutdown.deferred_scope';
  readonly category = 'shutdown';
  readonly name = 'Deferred Scope';
  readonly description = 'All deferred scope items with carry-forward tracking.';
  readonly optionalParams = ['scope_id'];

  async fetch(ctx: ProviderContext, _params: Record<string, any>): Promise<DataFetcherResult> {
    const deferrals = await (prisma.scopeDeferral as any).findMany({
      where: { organization_id: ctx.organizationId },
      select: { reason: true, deferred_at: true, target_event: true, carried_forward: true, scope_item: { select: { tag_number: true, asset_name: true } } },
      orderBy: { deferred_at: 'desc' },
    }).catch(() => []);
    return {
      rows: deferrals.map((d: any) => ({
        tag: d.scope_item?.tag_number ?? '—', asset: d.scope_item?.asset_name ?? '—',
        reason: d.reason?.slice(0, 80) ?? '—', deferred: d.deferred_at?.toISOString().split('T')[0] ?? '—',
        target: d.target_event ?? '—', carried: d.carried_forward ? 'Yes' : 'No',
      })),
      kpis: [
        { label: 'Deferred Items', value: deferrals.length },
        { label: 'Carried Forward', value: deferrals.filter((d: any) => d.carried_forward).length },
      ],
      metadata: { recordCount: deferrals.length },
    };
  }
}

export class WorkpackStatusProvider extends BaseProvider {
  readonly key = 'shutdown.workpack_status';
  readonly category = 'shutdown';
  readonly name = 'Workpack Status';
  readonly description = 'Workpack status breakdown for shutdown execution.';
  readonly optionalParams = ['site', 'event', 'contractor'];
  readonly maxRows = 300;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const workpacks = await prisma.workpack.findMany({
      where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) },
      select: { workpack_number: true, title: true, status: true, overall_progress: true, planned_start_date: true, planned_end_date: true },
      orderBy: { status: 'asc' }, take: this.maxRows,
    });
    const statusCounts: Record<string, number> = {};
    workpacks.forEach((w) => { statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1; });
    return {
      rows: workpacks.map((w) => ({
        workpack: w.workpack_number ?? '—', title: w.title, status: w.status, progress: `${w.overall_progress ?? 0}%`,
        start: w.planned_start_date?.toISOString().split('T')[0] ?? '—', end: w.planned_end_date?.toISOString().split('T')[0] ?? '—',
      })),
      kpis: Object.entries(statusCounts).map(([status, count]) => ({ label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: count })),
      metadata: { recordCount: workpacks.length },
    };
  }
}

import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';

async function getEventIds(orgId: string, params: Record<string, any>): Promise<string[]> {
  if (params.event) return [params.event];
  const where: any = { organization_id: orgId, deleted_at: null };
  if (params.site) where.site_id = params.site;
  const events = await prisma.event.findMany({ where, select: { id: true } });
  return events.map(e => e.id);
}

export class UnitProgressProvider extends BaseProvider {
  readonly key = 'shutdown.unit_progress';
  readonly category = 'shutdown';
  readonly name = 'Unit Progress';
  readonly description = 'Progress by unit — planned vs actual from M8.13 progress authority.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventIds = await getEventIds(ctx.organizationId, params);
    const unitMap = new Map<string, { totalActivities: number; completedActivities: number; weightedProgress: number; count: number }>();

    for (const eventId of eventIds) {
      const payload = await ProgressAggregationService.getEventProgress(ctx.organizationId, eventId, { includeUnit: true });
      for (const u of payload.byUnit ?? []) {
        const key = u.label ?? u.key ?? 'Unassigned';
        const cur = unitMap.get(key) ?? { totalActivities: 0, completedActivities: 0, weightedProgress: 0, count: 0 };
        cur.totalActivities += u.metrics.totalActivities;
        cur.completedActivities += u.metrics.completedActivities;
        cur.weightedProgress += u.metrics.weightedProgress;
        cur.count++;
        unitMap.set(key, cur);
      }
    }

    const rows = Array.from(unitMap.entries()).map(([unit, v]) => ({
      unit,
      activities: v.totalActivities,
      completed: v.completedActivities,
      planned: '100%',
      actual: `${v.count > 0 ? Math.round(v.weightedProgress / v.count) : 0}%`,
    }));

    return {
      rows,
      kpis: [
        { label: 'Units Tracked', value: rows.length },
        { label: 'Total Activities', value: rows.reduce((s, r) => s + r.activities, 0) },
      ],
      metadata: { recordCount: rows.length },
    };
  }
}

export class ContractorProgressProvider extends BaseProvider {
  readonly key = 'shutdown.contractor_progress';
  readonly category = 'shutdown';
  readonly name = 'Contractor Progress';
  readonly description = 'Progress by contractor from M8.13 progress authority.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventIds = await getEventIds(ctx.organizationId, params);
    const contractorMap = new Map<string, { totalActivities: number; completedActivities: number; weightedProgress: number; count: number }>();

    for (const eventId of eventIds) {
      const payload = await ProgressAggregationService.getEventProgress(ctx.organizationId, eventId, { includeContractor: true });
      for (const c of payload.byContractor ?? []) {
        const key = c.label ?? c.key ?? 'Unknown Contractor';
        const cur = contractorMap.get(key) ?? { totalActivities: 0, completedActivities: 0, weightedProgress: 0, count: 0 };
        cur.totalActivities += c.metrics.totalActivities;
        cur.completedActivities += c.metrics.completedActivities;
        cur.weightedProgress += c.metrics.weightedProgress;
        cur.count++;
        contractorMap.set(key, cur);
      }
    }

    const rows = Array.from(contractorMap.entries()).map(([contractor, v]) => ({
      contractor,
      activities: v.totalActivities,
      completed: v.completedActivities,
      avg_progress: `${v.count > 0 ? Math.round(v.weightedProgress / v.count) : 0}%`,
    }));

    return {
      rows,
      kpis: [
        { label: 'Contractors', value: rows.length },
        { label: 'Total Activities', value: rows.reduce((s, r) => s + r.activities, 0) },
      ],
      metadata: { recordCount: rows.length },
    };
  }
}

export class DisciplineProgressProvider extends BaseProvider {
  readonly key = 'shutdown.discipline_progress';
  readonly category = 'shutdown';
  readonly name = 'Discipline Progress';
  readonly description = 'Progress by discipline from M8.13 progress authority.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventIds = await getEventIds(ctx.organizationId, params);
    const disciplineMap = new Map<string, { totalActivities: number; completedActivities: number; weightedProgress: number; count: number }>();

    for (const eventId of eventIds) {
      const payload = await ProgressAggregationService.getEventProgress(ctx.organizationId, eventId, { includeDiscipline: true });
      for (const d of payload.byDiscipline ?? []) {
        const key = d.label ?? d.key ?? 'Unknown Discipline';
        const cur = disciplineMap.get(key) ?? { totalActivities: 0, completedActivities: 0, weightedProgress: 0, count: 0 };
        cur.totalActivities += d.metrics.totalActivities;
        cur.completedActivities += d.metrics.completedActivities;
        cur.weightedProgress += d.metrics.weightedProgress;
        cur.count++;
        disciplineMap.set(key, cur);
      }
    }

    const rows = Array.from(disciplineMap.entries()).map(([discipline, v]) => ({
      discipline,
      activities: v.totalActivities,
      completed: v.completedActivities,
      avg_progress: `${v.count > 0 ? Math.round(v.weightedProgress / v.count) : 0}%`,
    }));

    return {
      rows,
      kpis: [
        { label: 'Disciplines', value: rows.length },
        { label: 'Total Activities', value: rows.reduce((s, r) => s + r.activities, 0) },
      ],
      metadata: { recordCount: rows.length },
    };
  }
}

export const shutdownProviders = [
  new ScopeRegisterProvider(),
  new ScopeChangeRegisterProvider(),
  new DeferredScopeProvider(),
  new WorkpackStatusProvider(),
  new UnitProgressProvider(),
  new ContractorProgressProvider(),
  new DisciplineProgressProvider(),
];
