/**
 * M7.6D — Workforce Intelligence Providers
 *
 * 12 workforce providers consuming existing WorkforceService/Prisma.
 * Future integrations: REST API, Biometric, RFID, QR, SAP, Oracle HCM.
 */

import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';
import { prisma } from '@/lib/prisma';

// ─── Helpers ────────────────────────────────────────────────────────────────

function eventScope(p: Record<string, any>) {
  const w: any = { deleted_at: null };
  if (p.event) w.event_id = p.event;
  if (p.site) w.site_id = p.site;
  if (p.contractor) w.contractor_id = p.contractor;
  if (p.discipline) w.discipline_id = p.discipline;
  return w;
}

// ─── Providers ──────────────────────────────────────────────────────────────

class TodayAttendanceProvider extends BaseProvider {
  readonly key = 'workforce.today_attendance'; readonly category = 'workforce'; readonly name = "Today's Attendance";
  readonly description = 'Total attendance for today.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const today = new Date().toISOString().slice(0, 10);
    const records = await prisma.daily_attendance.findMany({
      where: { organization_id: ctx.organizationId, attendance_date: new Date(today), ...eventScope(params) },
      select: { headcount: true, contractor_id: true, discipline: true, shift: true },
    });
    const total = records.reduce((s, r) => s + (r.headcount ?? 0), 0);
    return { kpis: [{ label: "Today's Headcount", value: total, unit: 'pax' }], rows: records };
  }
}

class ContractorAttendanceProvider extends BaseProvider {
  readonly key = 'workforce.contractor_attendance'; readonly category = 'workforce'; readonly name = 'Contractor Attendance';
  readonly description = 'Attendance by contractor.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const today = new Date().toISOString().slice(0, 10);
    const records = await prisma.daily_attendance.groupBy({
      by: ['contractor_id'],
      where: { organization_id: ctx.organizationId, attendance_date: new Date(today), ...eventScope(params) },
      _sum: { headcount: true },
    });
    return { rows: records.map((r) => ({ contractorId: r.contractor_id, headcount: r._sum.headcount ?? 0 })) };
  }
}

class DisciplineAttendanceProvider extends BaseProvider {
  readonly key = 'workforce.discipline_attendance'; readonly category = 'workforce'; readonly name = 'Discipline Attendance';
  readonly description = 'Attendance by discipline.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const today = new Date().toISOString().slice(0, 10);
    const records = await prisma.daily_attendance.groupBy({
      by: ['discipline'],
      where: { organization_id: ctx.organizationId, attendance_date: new Date(today), ...eventScope(params) },
      _sum: { headcount: true },
    });
    return { rows: records.map((r) => ({ discipline: r.discipline, headcount: r._sum.headcount ?? 0 })) };
  }
}

class ShiftAttendanceProvider extends BaseProvider {
  readonly key = 'workforce.shift_attendance'; readonly category = 'workforce'; readonly name = 'Shift Attendance';
  readonly description = 'Attendance by shift.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const today = new Date().toISOString().slice(0, 10);
    const records = await prisma.daily_attendance.groupBy({
      by: ['shift'],
      where: { organization_id: ctx.organizationId, attendance_date: new Date(today), ...eventScope(params) },
      _sum: { headcount: true },
    });
    return { rows: records.map((r) => ({ shift: r.shift, headcount: r._sum.headcount ?? 0 })) };
  }
}

class CrewAvailabilityProvider extends BaseProvider {
  readonly key = 'workforce.crew_availability'; readonly category = 'workforce'; readonly name = 'Crew Availability';
  readonly description = 'Available vs required crew.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const today = new Date().toISOString().slice(0, 10);
    const actual = await prisma.daily_attendance.aggregate({
      where: { organization_id: ctx.organizationId, attendance_date: new Date(today), ...eventScope(params) },
      _sum: { headcount: true },
    });
    const planned = await prisma.activity.aggregate({
      where: { organization_id: ctx.organizationId, actual_end: null, early_start: { lte: new Date() }, early_finish: { gte: new Date() }, ...eventScope(params) },
      _sum: { crew_size: true },
    });
    const actualCount = actual._sum.headcount ?? 0;
    const plannedCount = planned._sum.crew_size ?? 0;
    return {
      kpis: [
        { label: 'Available', value: actualCount, unit: 'pax', color: '#10B981' },
        { label: 'Required', value: plannedCount, unit: 'pax' },
        { label: 'Variance', value: actualCount - plannedCount, color: actualCount >= plannedCount ? '#10B981' : '#DC2626' },
      ],
    };
  }
}

class ActualVsPlannedProvider extends BaseProvider {
  readonly key = 'workforce.actual_vs_planned'; readonly category = 'workforce'; readonly name = 'Actual vs Planned Manpower';
  readonly description = 'Daily actual vs planned manpower trend.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const records = await prisma.daily_attendance.findMany({
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      select: { attendance_date: true, headcount: true, planned_headcount: true },
      orderBy: { attendance_date: 'asc' },
      take: 90,
    });
    return {
      rows: records.map((r) => ({
        date: r.attendance_date,
        actual: r.headcount ?? 0,
        planned: r.planned_headcount ?? 0,
      })),
    };
  }
}

class OvertimeProvider extends BaseProvider {
  readonly key = 'workforce.overtime'; readonly category = 'workforce'; readonly name = 'Overtime';
  readonly description = 'Overtime hours tracking.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const records = await prisma.daily_attendance.aggregate({
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      _sum: { overtime_hours: true, regular_hours: true },
    });
    return {
      kpis: [
        { label: 'Total OT', value: Math.round(records._sum.overtime_hours ?? 0), unit: 'hrs' },
        { label: 'Regular', value: Math.round(records._sum.regular_hours ?? 0), unit: 'hrs' },
        { label: 'OT %', value: `${Math.round(((records._sum.overtime_hours ?? 0) / ((records._sum.regular_hours ?? 1) + (records._sum.overtime_hours ?? 0))) * 100)}%` },
      ],
    };
  }
}

class AbsenteeismProvider extends BaseProvider {
  readonly key = 'workforce.absenteeism'; readonly category = 'workforce'; readonly name = 'Absenteeism';
  readonly description = 'Absenteeism rate.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const today = new Date().toISOString().slice(0, 10);
    const att = await prisma.daily_attendance.aggregate({
      where: { organization_id: ctx.organizationId, attendance_date: new Date(today), ...eventScope(params) },
      _sum: { headcount: true, absent_count: true },
    });
    const total = (att._sum.headcount ?? 0) + (att._sum.absent_count ?? 0);
    const rate = total > 0 ? Math.round(((att._sum.absent_count ?? 0) / total) * 100) : 0;
    return { kpis: [{ label: 'Absent', value: att._sum.absent_count ?? 0 }, { label: 'Rate', value: `${rate}%`, color: rate > 10 ? '#DC2626' : '#10B981' }] };
  }
}

class ProductivityProvider extends BaseProvider {
  readonly key = 'workforce.productivity'; readonly category = 'workforce'; readonly name = 'Productivity';
  readonly description = 'Productivity metrics from manhours.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const att = await prisma.daily_attendance.aggregate({
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      _sum: { regular_hours: true, productive_hours: true },
    });
    const regular = att._sum.regular_hours ?? 0;
    const productive = att._sum.productive_hours ?? regular;
    const pct = regular > 0 ? Math.round((productive / regular) * 100) : 0;
    return { kpis: [{ label: 'Productive Hrs', value: Math.round(productive), unit: 'hrs' }, { label: 'Efficiency', value: `${pct}%`, color: pct >= 80 ? '#10B981' : '#F59E0B' }] };
  }
}

class ManhourBurnProvider extends BaseProvider {
  readonly key = 'workforce.manhour_burn'; readonly category = 'workforce'; readonly name = 'Manhour Burn';
  readonly description = 'Cumulative manhours consumed.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const records = await prisma.daily_attendance.findMany({
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      select: { attendance_date: true, regular_hours: true, overtime_hours: true },
      orderBy: { attendance_date: 'asc' },
    });
    let cumulative = 0;
    const rows = records.map((r) => {
      cumulative += (r.regular_hours ?? 0) + (r.overtime_hours ?? 0);
      return { date: r.attendance_date, daily: (r.regular_hours ?? 0) + (r.overtime_hours ?? 0), cumulative: Math.round(cumulative) };
    });
    return { rows, kpis: [{ label: 'Total Manhours', value: Math.round(cumulative), unit: 'hrs' }] };
  }
}

class SafetyManhourProvider extends BaseProvider {
  readonly key = 'workforce.safety_manhours'; readonly category = 'workforce'; readonly name = 'Safety Manhours';
  readonly description = 'LTI-free manhours.'; readonly requiredParams = ['event'];
  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const total = await prisma.daily_attendance.aggregate({
      where: { organization_id: ctx.organizationId, ...eventScope(params) },
      _sum: { regular_hours: true, overtime_hours: true },
    });
    const hrs = Math.round((total._sum.regular_hours ?? 0) + (total._sum.overtime_hours ?? 0));
    return { kpis: [{ label: 'LTI-Free Manhours', value: hrs, unit: 'hrs', color: '#10B981' }] };
  }
}

class ExternalIntegrationProvider extends BaseProvider {
  readonly key = 'workforce.external_integration_status'; readonly category = 'workforce'; readonly name = 'External Integration Status';
  readonly description = 'Status of external workforce integrations.'; readonly requiredParams = [];
  async fetch(): Promise<DataFetcherResult> {
    return {
      rows: [
        { system: 'REST API', status: 'Available', description: 'Custom REST endpoints' },
        { system: 'Biometric', status: 'Future', description: 'Fingerprint/facial recognition' },
        { system: 'RFID', status: 'Future', description: 'RFID badge scanning' },
        { system: 'QR Code', status: 'Future', description: 'QR-based check-in' },
        { system: 'Turnstile', status: 'Future', description: 'Access control gates' },
        { system: 'SAP', status: 'Future', description: 'SAP HR integration' },
        { system: 'Oracle HCM', status: 'Future', description: 'Oracle HR Cloud' },
        { system: 'CSV Import', status: 'Available', description: 'Manual CSV upload' },
        { system: 'Excel Import', status: 'Available', description: 'Manual Excel upload' },
      ],
    };
  }
}

// ─── Export All ──────────────────────────────────────────────────────────────

export const workforceIntelligenceProviders = [
  new TodayAttendanceProvider(), new ContractorAttendanceProvider(),
  new DisciplineAttendanceProvider(), new ShiftAttendanceProvider(),
  new CrewAvailabilityProvider(), new ActualVsPlannedProvider(),
  new OvertimeProvider(), new AbsenteeismProvider(),
  new ProductivityProvider(), new ManhourBurnProvider(),
  new SafetyManhourProvider(), new ExternalIntegrationProvider(),
];
