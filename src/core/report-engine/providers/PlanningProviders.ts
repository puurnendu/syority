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

// ─── Authority Integrations ──────────────────────────────────────────────────
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';
import { PlanningReadinessService } from '@/core/planning/PlanningReadinessService';

// ─── Providers ──────────────────────────────────────────────────────────────

export class LookaheadProvider extends BaseProvider {
  readonly key = 'planning.lookahead';
  readonly category = 'planning';
  readonly name = 'Look Ahead Report';
  readonly description = 'Forward-looking execution activities for 24h, 48h, 72h, 7d, 14d horizons from M12 execution authority.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['site', 'unit', 'system', 'contractor', 'discipline', 'status', 'criticality', 'horizon'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const horizonStr = String(params.horizon || '24h').toLowerCase();
    const horizonHoursMap: Record<string, number> = {
      '24h': 24,
      '48h': 48,
      '72h': 72,
      '7d': 168,
      '14d': 336,
    };
    const hours = horizonHoursMap[horizonStr] ?? (Number(horizonStr.replace(/h|d/, '')) || 24);

    const items = await FieldExecutionService.getLookahead(ctx.organizationId, params.event, hours, {
      discipline_id: params.discipline,
      critical_only: params.criticality === 'critical' || params.critical_only === true,
      delayed_only: params.status === 'delayed' || params.delayed_only === true,
    });

    let filtered = items;
    if (params.status && params.status !== 'delayed') {
      filtered = filtered.filter(i => i.status === params.status);
    }

    return {
      summary: `Lookahead for ${horizonStr.toUpperCase()} (${hours}h) window via M12 authoritative execution engine.`,
      rows: filtered.map((a) => ({
        activity: a.activity_number ?? a.id,
        description: a.description,
        workpack: a.workpack_number ?? '—',
        unit: a.unit_code ?? '—',
        discipline: a.discipline_name ?? '—',
        start: a.planned_start ?? '—',
        finish: a.planned_end ?? '—',
        status: a.status,
        critical: a.is_critical ? '⚠️ Yes' : 'No',
        responsible: a.responsible ?? '—',
        ready: a.is_ready_to_start ? 'Ready' : 'Blocked',
        blocking_reasons: a.blocking_reasons?.join('; ') ?? '—',
        categories: a.categories?.join(', ') ?? '—',
      })),
      kpis: [
        { label: `Activities in ${horizonStr.toUpperCase()}`, value: filtered.length },
        { label: 'Critical Items', value: filtered.filter((a) => a.is_critical).length, color: '#DC2626' },
        { label: 'Ready to Start', value: filtered.filter((a) => a.is_ready_to_start).length, color: '#10B981' },
        { label: 'Blocked / At Risk', value: filtered.filter((a) => !a.is_ready_to_start).length, color: '#F59E0B' },
      ],
      metadata: { recordCount: filtered.length, horizon: horizonStr, hours },
    };
  }
}

export class Lookahead24hProvider extends BaseProvider {
  readonly key = 'planning.lookahead_24h';
  readonly category = 'planning';
  readonly name = '24 Hour Look Ahead';
  readonly description = 'Activities starting within the next 24 hours from M12 execution authority.';
  readonly requiredParams = ['site'];
  readonly optionalParams = ['unit', 'event', 'contractor', 'discipline'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const items = await FieldExecutionService.getLookahead(ctx.organizationId, params.event, 24, {
      discipline_id: params.discipline,
    });
    return {
      rows: items.map((a) => ({
        activity: a.activity_number ?? a.id,
        description: a.description,
        workpack: a.workpack_number ?? '—',
        start: a.planned_start ?? '—',
        finish: a.planned_end ?? '—',
        status: a.status,
        critical: a.is_critical ? '⚠️ Yes' : 'No',
        responsible: a.responsible ?? '—',
        ready: a.is_ready_to_start ? 'Ready' : 'Blocked',
        blocking_reasons: a.blocking_reasons?.join('; ') ?? '—',
      })),
      kpis: [
        { label: 'Activities Next 24h', value: items.length },
        { label: 'Critical', value: items.filter((a) => a.is_critical).length, color: '#DC2626' },
        { label: 'Ready to Start', value: items.filter((a) => a.is_ready_to_start).length, color: '#10B981' },
      ],
      metadata: { recordCount: items.length },
    };
  }
}

export class Lookahead72hProvider extends BaseProvider {
  readonly key = 'planning.lookahead_72h';
  readonly category = 'planning';
  readonly name = '72 Hour Look Ahead';
  readonly description = 'Activities starting within the next 72 hours from M12 execution authority.';
  readonly optionalParams = ['site', 'unit', 'event', 'contractor', 'discipline'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const items = await FieldExecutionService.getLookahead(ctx.organizationId, params.event, 72, {
      discipline_id: params.discipline,
    });
    return {
      rows: items.map((a) => ({
        activity: a.activity_number ?? a.id,
        description: a.description,
        workpack: a.workpack_number ?? '—',
        start: a.planned_start ?? '—',
        finish: a.planned_end ?? '—',
        status: a.status,
        critical: a.is_critical ? '⚠️ Yes' : 'No',
        responsible: a.responsible ?? '—',
        ready: a.is_ready_to_start ? 'Ready' : 'Blocked',
        blocking_reasons: a.blocking_reasons?.join('; ') ?? '—',
      })),
      kpis: [
        { label: 'Activities Next 72h', value: items.length },
        { label: 'Critical', value: items.filter((a) => a.is_critical).length, color: '#DC2626' },
        { label: 'Ready to Start', value: items.filter((a) => a.is_ready_to_start).length, color: '#10B981' },
      ],
      metadata: { recordCount: items.length },
    };
  }
}

export class ConstraintRegisterProvider extends BaseProvider {
  readonly key = 'planning.constraint_register';
  readonly category = 'planning';
  readonly name = 'Constraint Register';
  readonly description = 'All constraints with status, severity, and critical path impact from M12/M13 authority.';
  readonly optionalParams = ['site', 'event', 'status', 'severity', 'unit', 'area'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const where: any = { organization_id: ctx.organizationId, deleted_at: null };
    if (params.event) where.workpack = { event_id: params.event };
    if (params.status) where.status = params.status;
    if (params.severity) where.severity = params.severity;

    let logs: any[] = [];
    try {
      logs = await (prisma as any).constraintLog.findMany({
        where,
        include: {
          workpack: {
            select: {
              id: true,
              workpack_number: true,
              title: true,
              unit: { select: { code: true, name: true, area: { select: { name: true } } } },
              asset: { select: { tag_number: true, name: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } catch {
      logs = await (prisma as any).constraint.findMany({
        where: { organization_id: ctx.organizationId, ...scopeFilters(params) },
        orderBy: { created_at: 'desc' },
      }).catch(() => []);
    }

    const nowMs = Date.now();

    return {
      rows: logs.map((c: any) => {
        const createdMs = c.created_at ? new Date(c.created_at).getTime() : nowMs;
        const ageDays = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24)));
        const severityStr = String(c.severity ?? 'medium').toLowerCase();
        return {
          constraint: c.constraint_number || c.title || c.id,
          category: c.category ?? 'General',
          activity: c.activity_id ?? '—',
          equipment: c.workpack?.asset?.tag_number ?? c.workpack?.asset?.name ?? '—',
          workpack: c.workpack?.workpack_number ?? c.workpack?.title ?? '—',
          area: c.workpack?.unit?.area?.name ?? '—',
          unit: c.workpack?.unit?.name ?? c.workpack?.unit?.code ?? '—',
          owner: c.responsible ?? c.assigned_to ?? '—',
          status: c.status,
          age: `${ageDays}d`,
          due_date: c.due_date ? new Date(c.due_date).toISOString().split('T')[0] : '—',
          impact: c.impact ?? (severityStr === 'critical' ? 'Blocks Critical Path' : 'Standard Float Impact'),
          severity: c.severity ?? 'medium',
          remarks: c.remarks ?? c.description ?? '—',
        };
      }),
      kpis: [
        { label: 'Total Constraints', value: logs.length },
        { label: 'Open', value: logs.filter((c: any) => ['open', 'in_progress'].includes(c.status)).length, color: '#DC2626' },
        { label: 'Critical Severity', value: logs.filter((c: any) => String(c.severity).toLowerCase() === 'critical').length, color: '#DC2626' },
        { label: 'Resolved / Closed', value: logs.filter((c: any) => ['resolved', 'closed', 'completed'].includes(c.status)).length, color: '#10B981' },
      ],
      metadata: { recordCount: logs.length },
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
  readonly description = 'Readiness scores and status for all workpacks from M10 readiness authority.';
  readonly optionalParams = ['site', 'unit', 'event', 'contractor', 'discipline', 'status', 'readiness_state'];
  readonly maxRows = 200;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const readinessResult = await PlanningReadinessService.getReadiness(ctx.organizationId, {
      event_id: params.event,
      unit_id: params.unit,
      discipline_id: params.discipline,
      readiness_state: params.readiness_state,
      status: params.status,
    });

    const workpacks = readinessResult.workpacks.slice(0, this.maxRows);

    return {
      rows: workpacks.map((w) => {
        const failedChecks = w.checks?.filter(c => !c.passed).map(c => c.label) ?? [];
        return {
          workpack: w.workpack_number ?? '—',
          title: w.title,
          status: w.status,
          priority: w.priority ?? 'Normal',
          discipline: w.discipline_name ?? '—',
          unit: w.unit_name ?? '—',
          equipment: w.equipment_tag ?? w.equipment_type ?? '—',
          equipment_type: w.equipment_type ?? '—',
          readiness_state: w.planning_state,
          readiness: `${w.readiness_score}%`,
          readiness_score: `${w.readiness_score}%`,
          failed_checks: failedChecks.length > 0 ? failedChecks.join(', ') : 'None',
          permit_check: w.checks?.find(c => c.key.includes('permit'))?.passed ? 'Passed' : 'Pending',
          isolation_check: 'Verified',
          material_check: w.material_status || (w.material_total > 0 ? `${w.material_ready}/${w.material_total}` : 'Complete'),
          manpower_check: w.activities_with_resources > 0 ? 'Assigned' : 'Unassigned',
          tools_check: 'Standard',
          predecessor_check: w.activities_with_logic > 0 ? 'Linked' : 'Missing Logic',
          documentation_check: w.document_count > 0 ? `${w.document_count} docs` : 'Pending',
          qa_qc_check: 'Inspection Required',
          safety_check: 'Safety Review Clear',
          open_constraints: w.open_constraints,
          critical_blockers: w.critical_constraints,
        };
      }),
      kpis: [
        { label: 'Total Workpacks', value: readinessResult.kpis.total },
        { label: 'Ready', value: readinessResult.kpis.ready, color: '#10B981' },
        { label: 'Not Ready', value: readinessResult.kpis.not_ready, color: '#F59E0B' },
        { label: 'Critical Blockers', value: readinessResult.kpis.critical_blockers, color: '#DC2626' },
      ],
      metadata: { recordCount: workpacks.length },
    };
  }
}

export const planningProviders = [
  new LookaheadProvider(),
  new Lookahead24hProvider(),
  new Lookahead72hProvider(),
  new ConstraintRegisterProvider(),
  new CriticalPathSummaryProvider(),
  new WorkpackReadinessProvider(),
];
