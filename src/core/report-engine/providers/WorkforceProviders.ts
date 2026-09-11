/**
 * M7.6C — Workforce Data Providers
 *
 * Providers for workforce/attendance data.
 * Phase 13: Reads from EXISTING models (SafetyLog, ActivityResource, shift_reports).
 * Future integrations (biometric, RFID, QR) will extend this file.
 */

import { prisma } from '@/lib/prisma';
import { BaseProvider, type ProviderContext } from '@/core/report-engine/providers/BaseProvider';
import type { DataFetcherResult } from '@/core/report-engine/data-fetchers';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEventId(params: Record<string, any>): string {
  return params.event ?? params.eventId ?? params.event_id ?? '';
}

// ─── Providers ──────────────────────────────────────────────────────────────

export class WorkforceHeadcountProvider extends BaseProvider {
  readonly key = 'workforce.headcount';
  readonly category = 'workforce';
  readonly name = 'Workforce Headcount';
  readonly description = 'Daily headcount from SafetyLog manpower data.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['date_from', 'date_to'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], kpis: [] };

    const where: any = { event_id: eventId };
    if (params.date_from || params.date_to) {
      where.log_date = {};
      if (params.date_from) where.log_date.gte = new Date(params.date_from);
      if (params.date_to) where.log_date.lte = new Date(params.date_to);
    }

    const logs = await prisma.safetyLog.findMany({
      where,
      orderBy: { log_date: 'asc' },
      select: {
        log_date: true,
        manpower_planned: true,
        manpower_actual: true,
        shift: true,
      },
    });

    const latest = logs.length > 0 ? logs[logs.length - 1] : null;
    const avgActual = logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + (l.manpower_actual ?? 0), 0) / logs.length)
      : 0;

    return {
      rows: logs.map((l) => ({
        date: l.log_date.toISOString().split('T')[0],
        shift: l.shift,
        planned: l.manpower_planned,
        actual: l.manpower_actual,
        variance: (l.manpower_actual ?? 0) - (l.manpower_planned ?? 0),
      })),
      chartData: logs.map((l) => ({
        date: l.log_date.toISOString().split('T')[0],
        planned: l.manpower_planned,
        actual: l.manpower_actual,
      })),
      kpis: [
        { label: 'Current Headcount', value: latest?.manpower_actual ?? 0, unit: 'pax' },
        { label: 'Planned', value: latest?.manpower_planned ?? 0, unit: 'pax' },
        { label: 'Average', value: avgActual, unit: 'pax' },
        { label: 'Data Points', value: logs.length },
      ],
    };
  }
}

export class WorkforceCrewUtilizationProvider extends BaseProvider {
  readonly key = 'workforce.crew_utilization';
  readonly category = 'workforce';
  readonly name = 'Crew Utilization';
  readonly description = 'Planned vs actual crew and hours by resource type.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], kpis: [] };

    // Get resources for this event's activities
    const resources = await (prisma.activityResource as any).findMany({
      where: { activity: { organization_id: ctx.organizationId, event_id: eventId, deleted_at: null } },
      select: {
        id: true,
        resource_type: true,
        planned_hours: true,
        actual_hours: true,
        quantity_planned: true,
        quantity_actual: true,
      },
    }).catch(() => []);

    const resourceSummary: Record<string, { planned: number; actual: number; hoursPlanned: number; hoursActual: number }> = {};
    for (const r of resources as any[]) {
      const key = r.resource_type ?? 'Unknown';
      if (!resourceSummary[key]) {
        resourceSummary[key] = { planned: 0, actual: 0, hoursPlanned: 0, hoursActual: 0 };
      }
      resourceSummary[key].planned += Number(r.quantity_planned ?? 0);
      resourceSummary[key].actual += Number(r.quantity_actual ?? 0);
      resourceSummary[key].hoursPlanned += Number(r.planned_hours ?? 0);
      resourceSummary[key].hoursActual += Number(r.actual_hours ?? 0);
    }

    const rows = Object.entries(resourceSummary).map(([type, data]) => ({
      resourceType: type,
      planned: data.planned,
      actual: data.actual,
      utilization: data.planned > 0 ? Math.round((data.actual / data.planned) * 100) : 0,
      hoursPlanned: data.hoursPlanned,
      hoursActual: data.hoursActual,
      hoursUtilization: data.hoursPlanned > 0 ? Math.round((data.hoursActual / data.hoursPlanned) * 100) : 0,
    }));

    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);

    return {
      rows,
      kpis: [
        { label: 'Total Planned', value: totalPlanned },
        { label: 'Total Actual', value: totalActual },
        {
          label: 'Overall Utilization',
          value: `${totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0}%`,
          color: totalActual >= totalPlanned ? '#10B981' : '#F59E0B',
        },
        { label: 'Resource Types', value: rows.length },
      ],
    };
  }
}

export class WorkforceManhourAnalysisProvider extends BaseProvider {
  readonly key = 'workforce.manhour_analysis';
  readonly category = 'workforce';
  readonly name = 'Manhour Analysis';
  readonly description = 'Daily manhour tracking from safety logs.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['date_from', 'date_to'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], kpis: [] };

    const where: any = { event_id: eventId };
    if (params.date_from || params.date_to) {
      where.log_date = {};
      if (params.date_from) where.log_date.gte = new Date(params.date_from);
      if (params.date_to) where.log_date.lte = new Date(params.date_to);
    }

    const logs = await prisma.safetyLog.findMany({
      where,
      orderBy: { log_date: 'asc' },
      select: {
        log_date: true,
        manhours_worked: true,
        manhours_planned: true,
        cumulative_manhours: true,
      },
    });

    const totalWorked = logs.reduce((s, l) => s + Number(l.manhours_worked ?? 0), 0);
    const totalPlanned = logs.reduce((s, l) => s + Number(l.manhours_planned ?? 0), 0);

    return {
      rows: logs.map((l) => ({
        date: l.log_date.toISOString().split('T')[0],
        worked: Number(l.manhours_worked ?? 0),
        planned: Number(l.manhours_planned ?? 0),
        cumulative: Number(l.cumulative_manhours ?? 0),
      })),
      chartData: logs.map((l) => ({
        date: l.log_date.toISOString().split('T')[0],
        worked: Number(l.manhours_worked ?? 0),
        planned: Number(l.manhours_planned ?? 0),
        cumulative: Number(l.cumulative_manhours ?? 0),
      })),
      kpis: [
        { label: 'Total Manhours Worked', value: Math.round(totalWorked).toLocaleString(), unit: 'hrs' },
        { label: 'Total Planned', value: Math.round(totalPlanned).toLocaleString(), unit: 'hrs' },
        {
          label: 'Variance',
          value: `${totalPlanned > 0 ? Math.round(((totalWorked - totalPlanned) / totalPlanned) * 100) : 0}%`,
          color: totalWorked >= totalPlanned ? '#10B981' : '#DC2626',
        },
      ],
    };
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const workforceProviders = [
  new WorkforceHeadcountProvider(),
  new WorkforceCrewUtilizationProvider(),
  new WorkforceManhourAnalysisProvider(),
];
