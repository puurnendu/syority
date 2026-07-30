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

export class DelayRegisterProvider extends BaseProvider {
  readonly key = 'execution.delay_register';
  readonly category = 'execution';
  readonly name = 'Delay Register';
  readonly description = 'Activities past their late finish date — delayed work.';
  readonly optionalParams = ['site', 'event'];
  readonly maxRows = 100;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: ctx.organizationId, deleted_at: null, actual_end: null, late_finish: { lt: new Date() }, ...scopeFilters(params) },
      select: { activity_number: true, description: true, late_finish: true, early_finish: true, status: true, workpack: { select: { workpack_number: true } } },
      orderBy: { late_finish: 'asc' }, take: this.maxRows,
    });
    return {
      rows: activities.map((a) => ({
        activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
        late_finish: a.late_finish?.toISOString().split('T')[0] ?? '—', status: a.status,
        days_late: a.late_finish ? Math.ceil((Date.now() - a.late_finish.getTime()) / 86400_000) : '—',
      })),
      kpis: [{ label: 'Delayed Activities', value: activities.length, color: '#DC2626' }],
      metadata: { recordCount: activities.length },
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

export const executionProviders = [
  new ShiftProgressProvider(),
  new DailyProgressProvider(),
  new DelayRegisterProvider(),
  new QaPendingProvider(),
  new CertificateStatusProvider(),
  new PunchRegisterProvider(),
];
