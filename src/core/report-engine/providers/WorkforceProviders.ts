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

    const where: any = { eventId };
    if (params.date_from || params.date_to) {
      where.logDate = {};
      if (params.date_from) where.logDate.gte = new Date(params.date_from);
      if (params.date_to) where.logDate.lte = new Date(params.date_to);
    }

    const logs = await prisma.safetyLog.findMany({
      where,
      orderBy: { logDate: 'asc' },
      select: {
        logDate: true,
        manpowerPlanned: true,
        manpowerActual: true,
        shift: true,
      },
    });

    const latest = logs.length > 0 ? logs[logs.length - 1] : null;
    const avgActual = logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + (l.manpowerActual ?? 0), 0) / logs.length)
      : 0;

    return {
      rows: logs.map((l) => ({
        date: l.logDate.toISOString().split('T')[0],
        shift: l.shift,
        planned: l.manpowerPlanned,
        actual: l.manpowerActual,
        variance: (l.manpowerActual ?? 0) - (l.manpowerPlanned ?? 0),
      })),
      chartData: logs.map((l) => ({
        date: l.logDate.toISOString().split('T')[0],
        planned: l.manpowerPlanned,
        actual: l.manpowerActual,
      })),
      kpis: [
        { label: 'Current Headcount', value: latest?.manpowerActual ?? 0, unit: 'pax' },
        { label: 'Planned', value: latest?.manpowerPlanned ?? 0, unit: 'pax' },
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
  readonly description = 'Resource utilization from ActivityResource assignments.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], kpis: [] };

    // Get workpacks for this event to find resource assignments
    const workpacks = await prisma.workpack.findMany({
      where: { event_id: eventId, organization_id: ctx.organizationId, deleted_at: null },
      select: {
        id: true,
        workpack_number: true,
        title: true,
        resources: {
          select: {
            id: true,
            resource_type: true,
            quantity_planned: true,
            quantity_actual: true,
            hours_planned: true,
            hours_actual: true,
          },
        },
      },
    });

    const resourceSummary: Record<string, { planned: number; actual: number; hoursPlanned: number; hoursActual: number }> = {};
    for (const wp of workpacks) {
      for (const r of wp.resources) {
        const key = r.resource_type ?? 'Unknown';
        if (!resourceSummary[key]) {
          resourceSummary[key] = { planned: 0, actual: 0, hoursPlanned: 0, hoursActual: 0 };
        }
        resourceSummary[key].planned += Number(r.quantity_planned ?? 0);
        resourceSummary[key].actual += Number(r.quantity_actual ?? 0);
        resourceSummary[key].hoursPlanned += Number(r.hours_planned ?? 0);
        resourceSummary[key].hoursActual += Number(r.hours_actual ?? 0);
      }
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

    const where: any = { eventId };
    if (params.date_from || params.date_to) {
      where.logDate = {};
      if (params.date_from) where.logDate.gte = new Date(params.date_from);
      if (params.date_to) where.logDate.lte = new Date(params.date_to);
    }

    const logs = await prisma.safetyLog.findMany({
      where,
      orderBy: { logDate: 'asc' },
      select: {
        logDate: true,
        manhoursWorked: true,
        manhoursPlanned: true,
        cumulativeManhours: true,
      },
    });

    const totalWorked = logs.reduce((s, l) => s + Number(l.manhoursWorked ?? 0), 0);
    const totalPlanned = logs.reduce((s, l) => s + Number(l.manhoursPlanned ?? 0), 0);

    return {
      rows: logs.map((l) => ({
        date: l.logDate.toISOString().split('T')[0],
        worked: Number(l.manhoursWorked ?? 0),
        planned: Number(l.manhoursPlanned ?? 0),
        cumulative: Number(l.cumulativeManhours ?? 0),
      })),
      chartData: logs.map((l) => ({
        date: l.logDate.toISOString().split('T')[0],
        worked: Number(l.manhoursWorked ?? 0),
        planned: Number(l.manhoursPlanned ?? 0),
        cumulative: Number(l.cumulativeManhours ?? 0),
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
