/**
 * M7.6C — Safety Data Providers
 *
 * 4 providers registered with ProviderRegistry:
 *   safety.daily_log — daily KPIs for a specific date
 *   safety.incident_register — incident list with pagination
 *   safety.kpi_summary — aggregated KPIs (TRIR, LTI rate, etc.)
 *   safety.trend — historical trend for charts
 *
 * All providers consume SafetyService — never raw Prisma.
 */

import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';
import { SafetyService } from '@/core/safety/SafetyService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEventId(params: Record<string, any>): string {
  return params.event ?? params.eventId ?? params.event_id ?? '';
}

// ─── Providers ──────────────────────────────────────────────────────────────

export class SafetyDailyLogProvider extends BaseProvider {
  readonly key = 'safety.daily_log';
  readonly category = 'safety';
  readonly name = 'Daily Safety Log';
  readonly description = 'Daily safety log with incidents, manhours, PTW status for a specific event.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['date'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], kpis: [] };

    const log = await SafetyService.getDailyLog(eventId, params.date);
    if (!log) {
      return {
        rows: [],
        kpis: [
          { label: 'No Data', value: 'No safety log found for this date', color: '#6B7280' },
        ],
      };
    }

    return {
      kpis: [
        { label: 'Manpower Actual', value: log.manpower_actual, unit: 'pax' },
        { label: 'Manhours Worked', value: Number(log.manhours_worked), unit: 'hrs' },
        { label: 'LTI', value: log.lti, color: log.lti > 0 ? '#DC2626' : '#10B981' },
        { label: 'Near Miss', value: log.near_miss, color: log.near_miss > 0 ? '#F59E0B' : '#10B981' },
        { label: 'First Aid', value: log.first_aid },
        { label: 'Medical Treatment', value: log.medical_treatment, color: log.medical_treatment > 0 ? '#DC2626' : '#10B981' },
        { label: 'PTW Issued', value: log.ptw_issued },
        { label: 'PTW Closed', value: log.ptw_closed },
        { label: 'Toolbox Talks', value: log.toolbox_talks },
      ],
      rows: (log.SafetyIncident ?? []).map((inc: any) => ({
        id: inc.id,
        type: inc.incident_type,
        severity: inc.severity,
        title: inc.title,
        location: inc.location ?? '—',
        contractor: inc.contractor ?? '—',
        status: inc.status,
        reportedBy: inc.reported_by ?? '—',
        date: inc.incident_date ? new Date(inc.incident_date).toISOString().split('T')[0] : '—',
      })),
      metadata: {
        logId: log.id,
        logDate: log.log_date ? new Date(log.log_date).toISOString().split('T')[0] : null,
        shift: log.shift,
        photoCount: (log.SafetyPhoto ?? []).length,
      },
    };
  }
}

export class SafetyIncidentRegisterProvider extends BaseProvider {
  readonly key = 'safety.incident_register';
  readonly category = 'safety';
  readonly name = 'Incident Register';
  readonly description = 'All safety incidents for an event with filtering and pagination.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['status', 'severity', 'type', 'page', 'pageSize'];
  readonly supportsPagination = true;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], kpis: [] };

    const result = await SafetyService.getIncidents(eventId, {
      status: params.status,
      severity: params.severity,
      type: params.type,
      page: params.page ? Number(params.page) : undefined,
      pageSize: params.pageSize ? Number(params.pageSize) : undefined,
    });

    // Compute KPIs from incidents
    const open = result.incidents.filter((i) => i.status === 'Open').length;
    const closed = result.incidents.filter((i) => i.status === 'Closed').length;

    return {
      rows: result.incidents.map((inc: any) => ({
        id: inc.id,
        date: inc.incident_date ? new Date(inc.incident_date).toISOString().split('T')[0] : '—',
        time: inc.incident_time ?? '—',
        type: inc.incident_type,
        severity: inc.severity,
        title: inc.title,
        description: inc.description,
        location: inc.location ?? '—',
        unitArea: inc.unit_area ?? '—',
        contractor: inc.contractor ?? '—',
        reportedBy: inc.reported_by ?? '—',
        actionOwner: inc.action_owner ?? '—',
        actionDueDate: inc.action_due_date ? new Date(inc.action_due_date).toISOString().split('T')[0] : '—',
        status: inc.status,
        rootCause: inc.root_cause ?? '—',
        correctiveActions: inc.corrective_actions ?? '—',
      })),
      kpis: [
        { label: 'Total Incidents', value: result.total },
        { label: 'Open', value: open, color: open > 0 ? '#DC2626' : '#10B981' },
        { label: 'Closed', value: closed, color: '#10B981' },
      ],
      metadata: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  }
}

export class SafetyKpiSummaryProvider extends BaseProvider {
  readonly key = 'safety.kpi_summary';
  readonly category = 'safety';
  readonly name = 'Safety KPI Summary';
  readonly description = 'Aggregated safety KPIs: TRIR, LTI Rate, Near Miss, PTW status, manhours.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { kpis: [] };

    const stats = await SafetyService.getStats(eventId);

    return {
      kpis: [
        { label: 'LTI', value: stats.totalLTI, color: stats.totalLTI > 0 ? '#DC2626' : '#10B981' },
        { label: 'TRIR', value: stats.trir, color: stats.trir > 2 ? '#DC2626' : stats.trir > 1 ? '#F59E0B' : '#10B981' },
        { label: 'LTI Frequency Rate', value: stats.ltiFrequencyRate },
        { label: 'Days Without LTI', value: stats.daysWithoutLTI, color: '#10B981' },
        { label: 'Near Miss', value: stats.totalNearMiss, color: '#F59E0B' },
        { label: 'First Aid', value: stats.totalFirstAid },
        { label: 'Medical Treatment', value: stats.totalMedicalTreatment, color: stats.totalMedicalTreatment > 0 ? '#DC2626' : '#10B981' },
        { label: 'Manhours Worked', value: Math.round(stats.totalManhours).toLocaleString(), unit: 'hrs' },
        { label: 'Manpower (Avg)', value: stats.logCount > 0 ? Math.round(stats.totalManpowerActual / stats.logCount) : 0, unit: 'pax' },
        { label: 'PTW Issued', value: stats.totalPtwIssued },
        { label: 'PTW Closed', value: stats.totalPtwClosed },
        { label: 'Toolbox Talks', value: stats.totalToolboxTalks },
      ],
      metadata: { ...stats },
    };
  }
}

export class SafetyTrendProvider extends BaseProvider {
  readonly key = 'safety.trend';
  readonly category = 'safety';
  readonly name = 'Safety Trend';
  readonly description = 'Historical safety trend data for charts — manhours, LTI, TRIR, near miss, PTW by date.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['date_from', 'date_to'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [], chartData: [] };

    const trend = await SafetyService.getTrend(eventId, {
      dateFrom: params.date_from,
      dateTo: params.date_to,
    });

    return {
      rows: trend,
      chartData: trend,
      kpis: [
        { label: 'Data Points', value: trend.length },
        { label: 'Period', value: trend.length > 0 ? `${trend[0].date} → ${trend[trend.length - 1].date}` : '—' },
      ],
    };
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const safetyProviders = [
  new SafetyDailyLogProvider(),
  new SafetyIncidentRegisterProvider(),
  new SafetyKpiSummaryProvider(),
  new SafetyTrendProvider(),
];
