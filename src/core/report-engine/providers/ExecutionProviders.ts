/**
 * M7.6B — Execution Data Providers
 *
 * 6 providers: shift_progress, daily_progress, delay_register,
 * qa_pending, certificate_status, punch_register.
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

export class ShiftProgressProvider extends BaseProvider {
  readonly key = 'execution.shift_progress';
  readonly category = 'execution';
  readonly name = 'Shift Progress Report';
  readonly description = 'Activities progressed during the current shift (last 12 hours).';
  readonly optionalParams = ['site', 'unit', 'event', 'shift'];
  readonly maxRows = 200;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const now = new Date();
    const shiftStart = new Date(now); shiftStart.setHours(shiftStart.getHours() - 12);
    const logs = await prisma.progressLog.findMany({
      where: { organization_id: ctx.organizationId, created_at: { gte: shiftStart }, ...scopeFilters(params) },
      select: { activity: { select: { activity_number: true, description: true, workpack: { select: { workpack_number: true } } } }, old_progress: true, new_progress: true, created_at: true, created_by_user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    return {
      rows: (logs as any[]).map((l) => ({
        activity: l.activity?.activity_number ?? '—', description: l.activity?.description ?? '—',
        workpack: l.activity?.workpack?.workpack_number ?? '—',
        from: `${l.old_progress ?? 0}%`, to: `${l.new_progress ?? 0}%`,
        by: l.created_by_user?.name ?? '—', time: l.created_at?.toISOString().slice(11, 16) ?? '—',
      })),
      kpis: [{ label: 'Progress Updates', value: logs.length }],
      metadata: { recordCount: logs.length },
    };
  }
}

export class DailyProgressProvider extends BaseProvider {
  readonly key = 'execution.daily_progress';
  readonly category = 'execution';
  readonly name = 'Daily Progress Report';
  readonly description = "All progress updates recorded today.";
  readonly optionalParams = ['site', 'unit', 'event'];
  readonly maxRows = 300;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const logs = await prisma.progressLog.findMany({
      where: { organization_id: ctx.organizationId, created_at: { gte: todayStart }, ...scopeFilters(params) },
      select: { activity: { select: { activity_number: true, description: true } }, old_progress: true, new_progress: true, created_at: true },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    return {
      rows: (logs as any[]).map((l) => ({
        activity: l.activity?.activity_number ?? '—', description: l.activity?.description ?? '—',
        from: `${l.old_progress ?? 0}%`, to: `${l.new_progress ?? 0}%`,
        time: l.created_at?.toISOString().slice(11, 16) ?? '—',
      })),
      kpis: [{ label: "Today's Updates", value: logs.length }],
      metadata: { recordCount: logs.length },
    };
  }
}

// ─── Field Execution Authority Integration (M12) ─────────────────────────────────
// M14 R2: Rewired delay calculations to the authoritative Field Execution engine.
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';

async function fetchAuthoritativeDelays(orgId: string, params: Record<string, any>) {
  let eventIds = params.event ? [params.event] : [];
  
  if (eventIds.length === 0) {
    const where: any = { organization_id: orgId, deleted_at: null };
    if (params.site) where.site_id = params.site;
    const events = await prisma.event.findMany({ where, select: { id: true } });
    eventIds = events.map(e => e.id);
  }

  const allDelays: any[] = [];
  
  for (const eventId of eventIds) {
    const pva = await FieldExecutionService.getPlanVsActual(orgId, eventId);
    
    // Filter for delayed items using M12 logic
    const delays = pva.filter(item => item.is_delayed);
    
    for (const d of delays) {
      allDelays.push({
        activity: d.activity_number ?? d.id,
        description: d.description,
        workpack: d.workpack_number ?? '—',
        late_finish: d.planned_end ?? '—',
        status: d.status,
        days_late: d.finish_variance_hours !== null ? Math.ceil(d.finish_variance_hours / 24) : '—',
        severity: d.is_critical ? 'P1' : 'P3', // Map criticality to severity for sorting
      });
    }
  }

  return allDelays;
}

export class DelayRegisterProvider extends BaseProvider {
  readonly key = 'execution.delay_register';
  readonly category = 'execution';
  readonly name = 'Delay Register';
  readonly description = 'Activities past their late finish date — delayed work.';
  readonly optionalParams = ['site', 'event'];
  readonly maxRows = 100;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const delayedItems = await fetchAuthoritativeDelays(ctx.organizationId, params);
    
    // Sort by severity (P1 -> P4)
    delayedItems.sort((a, b) => a.severity.localeCompare(b.severity));
    
    const rows = delayedItems.slice(0, this.maxRows);

    return {
      rows,
      kpis: [{ label: 'Delayed Activities', value: delayedItems.length, color: '#DC2626' }],
      metadata: { recordCount: delayedItems.length },
    };
  }
}

export class QaPendingProvider extends BaseProvider {
  readonly key = 'execution.qa_pending';
  readonly category = 'execution';
  readonly name = 'QA Pending';
  readonly description = 'QA checks awaiting clearance.';
  readonly optionalParams = ['site'];
  readonly maxRows = 100;

  async fetch(ctx: ProviderContext, _params: Record<string, any>): Promise<DataFetcherResult> {
    const records = await prisma.qa_clearance_records.findMany({
      where: { organization_id: ctx.organizationId, status: { in: ['pending', 'in_progress'] } },
      select: { check_type: true, status: true, activity: { select: { activity_number: true, description: true } }, assigned_to_user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    return {
      rows: (records as any[]).map((r) => ({
        activity: r.activity?.activity_number ?? '—', description: r.activity?.description ?? '—',
        type: r.check_type ?? '—', status: r.status, assigned: r.assigned_to_user?.name ?? '—',
      })),
      kpis: [{ label: 'Pending QA Checks', value: records.length, color: '#F59E0B' }],
      metadata: { recordCount: records.length },
    };
  }
}

export class CertificateStatusProvider extends BaseProvider {
  readonly key = 'execution.certificate_status';
  readonly category = 'execution';
  readonly name = 'Certificate Status';
  readonly description = 'Certificates by type and status.';
  readonly optionalParams = ['site'];
  readonly maxRows = 200;

  async fetch(ctx: ProviderContext, _params: Record<string, any>): Promise<DataFetcherResult> {
    const certs = await prisma.certificate.findMany({
      where: { organization_id: ctx.organizationId },
      select: { certificate_type: true, status: true, workpack: { select: { workpack_number: true } } },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    const statusCounts: Record<string, number> = {};
    (certs as any[]).forEach((c) => { statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1; });
    return {
      rows: (certs as any[]).map((c) => ({
        workpack: c.workpack?.workpack_number ?? '—', type: c.certificate_type ?? '—', status: c.status,
      })),
      kpis: Object.entries(statusCounts).map(([status, count]) => ({ label: status, value: count })),
      metadata: { recordCount: certs.length },
    };
  }
}

export class PunchRegisterProvider extends BaseProvider {
  readonly key = 'execution.punch_register';
  readonly category = 'execution';
  readonly name = 'Punch List Register';
  readonly description = 'All punch items by category, status, and priority.';
  readonly optionalParams = ['site', 'event', 'status', 'priority'];
  readonly maxRows = 300;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const punches = await prisma.punchListItem.findMany({
      where: { organization_id: ctx.organizationId, deleted_at: null, ...scopeFilters(params) },
      select: { punch_number: true, description: true, category: true, status: true, priority: true, assigned_to: true },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    const catCounts: Record<string, number> = {};
    (punches as any[]).forEach((p) => { catCounts[p.category ?? 'Other'] = (catCounts[p.category ?? 'Other'] ?? 0) + 1; });
    return {
      rows: (punches as any[]).map((p) => ({
        number: p.punch_number ?? '—', description: p.description ?? '—', category: p.category ?? '—',
        status: p.status, priority: p.priority ?? '—', assigned: p.assigned_to ?? '—',
      })),
      kpis: [
        { label: 'Total Punches', value: punches.length },
        ...Object.entries(catCounts).map(([cat, count]) => ({ label: `Cat ${cat}`, value: count })),
      ],
      metadata: { recordCount: punches.length },
    };
  }
}

export class HoldsAndDelaysProvider extends BaseProvider {
  readonly key = 'execution.holds_and_delays';
  readonly category = 'execution';
  readonly name = 'Holds & Delays Report';
  readonly description = 'Activities currently on hold or actively delayed past their finish date from M12 execution facts.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['site', 'unit', 'contractor', 'discipline', 'status'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const [pva, board] = await Promise.all([
      FieldExecutionService.getPlanVsActual(ctx.organizationId, params.event),
      FieldExecutionService.getExecutionBoard(ctx.organizationId, params.event).catch(() => []),
    ]);

    const boardMap = new Map<string, any>();
    for (const b of board) {
      boardMap.set(b.id, b);
    }

    // Filter items that are either delayed OR on hold
    const holdOrDelayed = pva.filter((item) => {
      const b = boardMap.get(item.id);
      const isHold = b ? (b.has_hold_point && !b.hold_point_cleared) || item.status === 'on_hold' : item.status === 'on_hold';
      return item.is_delayed || isHold;
    });

    const rows = holdOrDelayed.map((item) => {
      const b = boardMap.get(item.id);
      const isHold = b ? (b.has_hold_point && !b.hold_point_cleared) || item.status === 'on_hold' : item.status === 'on_hold';
      const holdCategory = isHold ? (b?.hold_point_type ?? 'Execution Hold') : 'None';
      const delayCategory = item.is_delayed ? (b?.delay_reason ?? 'Finish Variance') : 'None';
      const impactStr = item.finish_variance_hours !== null
        ? `${Math.round(item.finish_variance_hours)}h (${Math.ceil(item.finish_variance_hours / 24)}d)`
        : isHold ? 'Hold Point Blocking' : 'Minimal';

      return {
        activity: item.activity_number ?? item.id,
        description: item.description,
        equipment: b?.unit_code ?? '—',
        workpack: item.workpack_number ?? '—',
        hold_reason_category: holdCategory,
        delay_reason_category: delayCategory,
        start: item.actual_start ?? item.planned_start ?? '—',
        duration: `${item.duration_hours}h`,
        current_status: item.status,
        responsible_party: b?.responsible ?? '—',
        impact: impactStr,
        remarks: b?.blocking_reasons?.join('; ') ?? (isHold ? 'Hold point pending clearance' : item.is_delayed ? 'Delayed past plan' : '—'),
      };
    });

    const delayedCount = holdOrDelayed.filter(i => i.is_delayed).length;
    const holdCount = holdOrDelayed.length - delayedCount;

    return {
      summary: `Holds & Delays for event: ${holdOrDelayed.length} total exceptions identified from M12 execution facts.`,
      rows,
      kpis: [
        { label: 'Total Exceptions', value: holdOrDelayed.length, color: holdOrDelayed.length > 0 ? '#DC2626' : '#10B981' },
        { label: 'Delayed Activities', value: delayedCount, color: '#DC2626' },
        { label: 'Hold Points Active', value: holdCount, color: '#F59E0B' },
      ],
      metadata: { recordCount: rows.length },
    };
  }
}

export const executionProviders = [
  new ShiftProgressProvider(),
  new DailyProgressProvider(),
  new DelayRegisterProvider(),
  new HoldsAndDelaysProvider(),
  new QaPendingProvider(),
  new CertificateStatusProvider(),
  new PunchRegisterProvider(),
];
