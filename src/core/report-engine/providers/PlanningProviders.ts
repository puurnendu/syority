/**
 * M7.6B — Planning Data Providers
 *
 * 5 providers: lookahead_24h, lookahead_72h, constraint_register,
 * critical_path_summary, workpack_readiness.
 */

import { prisma } from '@/lib/prisma';
import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';

// ─── Helpers ────────────────────────────────────────────────────────────────

function scopeFilters(params: Record<string, any>) {
  const where: any = {};
  if (params.site) where.site_id = params.site;
  if (params.unit) where.unit_id = params.unit;
  if (params.event) where.event_id = params.event;
  if (params.contractor) where.contractor_id = params.contractor;
  if (params.discipline) where.discipline_id = params.discipline;
  return where;
}

// ─── Providers ──────────────────────────────────────────────────────────────

export class Lookahead24hProvider extends BaseProvider {
  readonly key = 'planning.lookahead_24h';
  readonly category = 'planning';
  readonly name = '24 Hour Look Ahead';
  readonly description = 'Activities starting within the next 24 hours.';
  readonly requiredParams = ['site'];
  readonly optionalParams = ['unit', 'event', 'contractor', 'discipline'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600_000);
    const activities = await prisma.activity.findMany({
      where: {
        organization_id: ctx.organizationId, deleted_at: null,
        early_start: { gte: now, lte: in24h }, actual_end: null,
        ...scopeFilters(params),
      },
      select: {
        activity_number: true, description: true, status: true, early_start: true,
        early_finish: true, is_critical: true, responsible: true,
        workpack: { select: { title: true, workpack_number: true } },
      },
      orderBy: { early_start: 'asc' },
    });
    return {
      rows: activities.map((a) => ({
        activity: a.activity_number, description: a.description,
        workpack: a.workpack?.workpack_number ?? '—',
        start: a.early_start?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
        finish: a.early_finish?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
        status: a.status, critical: a.is_critical ? '⚠️ Yes' : 'No', responsible: a.responsible ?? '—',
      })),
      kpis: [
        { label: 'Activities Next 24h', value: activities.length },
        { label: 'Critical', value: activities.filter((a) => a.is_critical).length, color: '#DC2626' },
      ],
      metadata: { recordCount: activities.length },
    };
  }
}

export class Lookahead72hProvider extends BaseProvider {
  readonly key = 'planning.lookahead_72h';
  readonly category = 'planning';
  readonly name = '72 Hour Look Ahead';
  readonly description = 'Activities starting within the next 72 hours.';
  readonly optionalParams = ['site', 'unit', 'event', 'contractor', 'discipline'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const now = new Date();
    const in72h = new Date(now.getTime() + 72 * 3600_000);
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, deleted_at: null, early_start: { gte: now, lte: in72h }, actual_end: null, ...scopeFilters(params) },
      select: { activity_number: true, description: true, status: true, early_start: true, early_finish: true, is_critical: true, responsible: true, workpack: { select: { title: true, workpack_number: true } } },
      orderBy: { early_start: 'asc' },
    });
    return {
      rows: activities.map((a) => ({
        activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
        start: a.early_start?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
        finish: a.early_finish?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
        status: a.status, critical: a.is_critical ? '⚠️ Yes' : 'No',
      })),
      kpis: [
        { label: 'Activities Next 72h', value: activities.length },
        { label: 'Critical', value: activities.filter((a) => a.is_critical).length, color: '#DC2626' },
      ],
      metadata: { recordCount: activities.length },
    };
  }
}

export class ConstraintRegisterProvider extends BaseProvider {
  readonly key = 'planning.constraint_register';
  readonly category = 'planning';
  readonly name = 'Constraint Register';
  readonly description = 'All constraints with status tracking.';
  readonly optionalParams = ['site', 'event', 'status'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const constraints = await prisma.constraint.findMany({
      where: { organization_id: ctx.organizationId, ...scopeFilters(params) },
      select: { id: true, description: true, type: true, status: true, severity: true, responsible: true, created_at: true, due_date: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => []);
    return {
      rows: constraints.map((c: any) => ({
        description: c.description, type: c.type ?? '—', status: c.status, severity: c.severity ?? '—',
        responsible: c.responsible ?? '—', due: c.due_date?.toISOString().split('T')[0] ?? '—',
      })),
      kpis: [
        { label: 'Total Constraints', value: constraints.length },
        { label: 'Open', value: constraints.filter((c: any) => c.status === 'open').length, color: '#DC2626' },
      ],
      metadata: { recordCount: constraints.length },
    };
  }
}

export class CriticalPathSummaryProvider extends BaseProvider {
  readonly key = 'planning.critical_path_summary';
  readonly category = 'planning';
  readonly name = 'Critical Path Summary';
  readonly description = 'All activities on the critical path with float analysis.';
  readonly optionalParams = ['site', 'event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, deleted_at: null, is_critical: true, ...scopeFilters(params) },
      select: { activity_number: true, description: true, early_start: true, early_finish: true, total_float: true, status: true, workpack: { select: { workpack_number: true } } },
      orderBy: { early_start: 'asc' },
    });
    return {
      rows: activities.map((a) => ({
        activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
        start: a.early_start?.toISOString().split('T')[0] ?? '—', finish: a.early_finish?.toISOString().split('T')[0] ?? '—',
        float: a.total_float != null ? Number(a.total_float) : '—', status: a.status,
      })),
      kpis: [{ label: 'Critical Activities', value: activities.length, color: '#DC2626' }],
      metadata: { recordCount: activities.length },
    };
  }
}

export class WorkpackReadinessProvider extends BaseProvider {
  readonly key = 'planning.workpack_readiness';
  readonly category = 'planning';
  readonly name = 'Workpack Readiness';
  readonly description = 'Readiness scores and status for all workpacks.';
  readonly optionalParams = ['site', 'unit', 'event', 'contractor', 'discipline'];
  readonly maxRows = 200;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const workpacks = await prisma.workpack.findMany({
      where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) },
      select: { workpack_number: true, title: true, status: true, overall_progress: true, priority: true, discipline: { select: { name: true } }, contractor: { select: { name: true } } },
      orderBy: { workpack_number: 'asc' },
      take: this.maxRows,
    });
    const instantiations = await prisma.workpackInstantiation.findMany({
      where: { organization_id: ctx.organizationId, workpack_id: { in: workpacks.map((w) => w.workpack_number).filter(Boolean) as string[] } },
      select: { workpack_id: true, readiness_score: true, compliance_score: true },
    }).catch(() => []);
    const scoreMap = new Map(instantiations.map((i) => [i.workpack_id, i]));
    return {
      rows: workpacks.map((w) => ({
        workpack: w.workpack_number ?? '—', title: w.title, status: w.status,
        progress: `${w.overall_progress ?? 0}%`, priority: w.priority ?? 'Normal',
        discipline: w.discipline?.name ?? '—', contractor: w.contractor?.name ?? '—',
        readiness: scoreMap.get(w.workpack_number ?? '')?.readiness_score ?? '—',
      })),
      kpis: [
        { label: 'Total Workpacks', value: workpacks.length },
        { label: 'Draft', value: workpacks.filter((w) => w.status === 'draft').length },
        { label: 'In Progress', value: workpacks.filter((w) => w.status === 'in_progress').length, color: '#2563EB' },
      ],
      metadata: { recordCount: workpacks.length },
    };
  }
}

export const planningProviders = [
  new Lookahead24hProvider(),
  new Lookahead72hProvider(),
  new ConstraintRegisterProvider(),
  new CriticalPathSummaryProvider(),
  new WorkpackReadinessProvider(),
];
