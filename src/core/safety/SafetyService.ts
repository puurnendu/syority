/**
 * M7.6C — Safety Service (corrected for snake_case schema fields)
 *
 * Centralizes safety business logic previously inline in API routes.
 * Consumed by SafetyProviders (Report Engine) and OIS widgets.
 * Pattern: Service → Prisma. Providers → Service (never raw Prisma).
 *
 * SCHEMA NOTE: SafetyLog, SafetyIncident, SafetyPhoto models use snake_case
 * field names. All Prisma queries here use snake_case to match.
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SafetyKpis {
  totalManhours: number;
  totalManhoursPlanned: number;
  totalLTI: number;
  ltiFrequencyRate: number;
  totalNearMiss: number;
  totalFirstAid: number;
  totalMedicalTreatment: number;
  totalDangerousOccurrence: number;
  totalPtwIssued: number;
  totalPtwClosed: number;
  totalPtwSuspended: number;
  totalToolboxTalks: number;
  totalManpowerPlanned: number;
  totalManpowerActual: number;
  trir: number;
  daysWithoutLTI: number;
  logCount: number;
}

export interface SafetyTrendPoint {
  date: string;
  manhours: number;
  lti: number;
  nearMiss: number;
  firstAid: number;
  medicalTreatment: number;
  cumulativeManhours: number;
  cumulativeLti: number;
  ltiRate: number;
  trir: number;
  manpowerActual: number;
  ptwIssued: number;
}

export interface SafetyLogSummary {
  id: string;
  eventId: string;
  logDate: Date;
  shift: string;
  manpowerPlanned: number;
  manpowerActual: number;
  lti: number;
  nearMiss: number;
  firstAid: number;
  medicalTreatment: number;
  dangerousOccurrence: number;
  manhours: number;
  ptwIssued: number;
  ptwClosed: number;
  toolboxTalks: number;
  incidentCount: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class SafetyService {

  /**
   * Fetch the latest or date-specific safety log with incidents and photos.
   */
  static async getDailyLog(eventId: string, date?: string) {
    const where: any = { event_id: eventId };
    if (date) where.log_date = new Date(date);

    return prisma.safetyLog.findFirst({
      where,
      orderBy: { log_date: 'desc' },
      include: {
        SafetyIncident: {
          include: {
            SafetyPhoto: { select: { id: true, public_url: true, photo_type: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        SafetyPhoto: {
          select: { id: true, public_url: true, photo_type: true },
          orderBy: { taken_at: 'desc' },
        },
      },
    });
  }

  /**
   * Fetch all safety logs for an event with summary data.
   */
  static async listLogs(eventId: string, opts?: {
    page?: number;
    pageSize?: number;
  }): Promise<{ logs: SafetyLogSummary[]; total: number }> {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 50;

    const [logs, total] = await Promise.all([
      prisma.safetyLog.findMany({
        where: { event_id: eventId },
        orderBy: { log_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          SafetyIncident: { select: { id: true } },
        },
      }),
      prisma.safetyLog.count({ where: { event_id: eventId } }),
    ]);

    return {
      logs: logs.map((l: any) => ({
        id: l.id,
        eventId: l.event_id,
        logDate: l.log_date,
        shift: l.shift,
        manpowerPlanned: l.manpower_planned,
        manpowerActual: l.manpower_actual,
        lti: l.lti,
        nearMiss: l.near_miss,
        firstAid: l.first_aid,
        medicalTreatment: l.medical_treatment,
        dangerousOccurrence: l.dangerous_occurrence,
        manhours: Number(l.manhours_worked ?? 0),
        ptwIssued: l.ptw_issued,
        ptwClosed: l.ptw_closed,
        toolboxTalks: l.toolbox_talks,
        incidentCount: l.SafetyIncident.length,
      })),
      total,
    };
  }

  /**
   * Compute aggregate safety KPIs for an event.
   */
  static async getStats(eventId: string): Promise<SafetyKpis> {
    const logs = await prisma.safetyLog.findMany({
      where: { event_id: eventId },
      orderBy: { log_date: 'asc' },
      select: {
        log_date: true,
        lti: true,
        lti_days_lost: true,
        near_miss: true,
        first_aid: true,
        medical_treatment: true,
        dangerous_occurrence: true,
        manhours_worked: true,
        manhours_planned: true,
        manpower_planned: true,
        manpower_actual: true,
        ptw_issued: true,
        ptw_closed: true,
        ptw_suspended: true,
        toolbox_talks: true,
      },
    });

    const totalManhours = logs.reduce((s: number, l: any) => s + Number(l.manhours_worked ?? 0), 0);
    const totalLTI = logs.reduce((s: number, l: any) => s + (l.lti ?? 0), 0);
    const totalNearMiss = logs.reduce((s: number, l: any) => s + (l.near_miss ?? 0), 0);
    const totalFirstAid = logs.reduce((s: number, l: any) => s + (l.first_aid ?? 0), 0);
    const totalMedicalTreatment = logs.reduce((s: number, l: any) => s + (l.medical_treatment ?? 0), 0);
    const totalDangerousOccurrence = logs.reduce((s: number, l: any) => s + (l.dangerous_occurrence ?? 0), 0);

    // TRIR = (Total Recordable Incidents × 200,000) / Total Manhours
    const totalRecordable = totalLTI + totalMedicalTreatment + totalDangerousOccurrence;
    const trir = totalManhours > 0 ? (totalRecordable * 200_000) / totalManhours : 0;

    // LTI Frequency Rate = (LTI × 1,000,000) / Manhours
    const ltiRate = totalManhours > 0 ? (totalLTI * 1_000_000) / totalManhours : 0;

    // Days without LTI — count from last LTI log date to today
    let daysWithoutLTI = 0;
    const lastLTILog = [...logs].reverse().find((l: any) => l.lti > 0);
    if (lastLTILog) {
      daysWithoutLTI = Math.floor(
        (Date.now() - new Date(lastLTILog.log_date).getTime()) / 86_400_000
      );
    } else if (logs.length > 0) {
      daysWithoutLTI = Math.floor(
        (Date.now() - new Date(logs[0].log_date).getTime()) / 86_400_000
      );
    }

    return {
      totalManhours,
      totalManhoursPlanned: logs.reduce((s: number, l: any) => s + Number(l.manhours_planned ?? 0), 0),
      totalLTI,
      ltiFrequencyRate: Math.round(ltiRate * 100) / 100,
      totalNearMiss,
      totalFirstAid,
      totalMedicalTreatment,
      totalDangerousOccurrence,
      totalPtwIssued: logs.reduce((s: number, l: any) => s + (l.ptw_issued ?? 0), 0),
      totalPtwClosed: logs.reduce((s: number, l: any) => s + (l.ptw_closed ?? 0), 0),
      totalPtwSuspended: logs.reduce((s: number, l: any) => s + (l.ptw_suspended ?? 0), 0),
      totalToolboxTalks: logs.reduce((s: number, l: any) => s + (l.toolbox_talks ?? 0), 0),
      totalManpowerPlanned: logs.reduce((s: number, l: any) => s + (l.manpower_planned ?? 0), 0),
      totalManpowerActual: logs.reduce((s: number, l: any) => s + (l.manpower_actual ?? 0), 0),
      trir: Math.round(trir * 100) / 100,
      daysWithoutLTI,
      logCount: logs.length,
    };
  }

  /**
   * Compute daily trend data for charts.
   */
  static async getTrend(eventId: string, opts?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<SafetyTrendPoint[]> {
    const where: any = { event_id: eventId };
    if (opts?.dateFrom || opts?.dateTo) {
      where.log_date = {};
      if (opts?.dateFrom) where.log_date.gte = new Date(opts.dateFrom);
      if (opts?.dateTo) where.log_date.lte = new Date(opts.dateTo);
    }

    const logs = await prisma.safetyLog.findMany({
      where,
      orderBy: { log_date: 'asc' },
    });

    return logs.map((l: any) => {
      const manhours = Number(l.manhours_worked ?? 0);
      const cumManhours = Number(l.cumulative_manhours ?? 0);
      const cumLti = l.cumulative_lti ?? 0;
      const totalRecordable = (l.lti ?? 0) + (l.medical_treatment ?? 0) + (l.dangerous_occurrence ?? 0);
      const trir = cumManhours > 0 ? (totalRecordable * 200_000) / cumManhours : 0;

      return {
        date: l.log_date.toISOString().split('T')[0],
        manhours,
        lti: l.lti ?? 0,
        nearMiss: l.near_miss ?? 0,
        firstAid: l.first_aid ?? 0,
        medicalTreatment: l.medical_treatment ?? 0,
        cumulativeManhours: cumManhours,
        cumulativeLti: cumLti,
        ltiRate: Number(l.lti_frequency_rate ?? 0),
        trir: Math.round(trir * 100) / 100,
        manpowerActual: l.manpower_actual ?? 0,
        ptwIssued: l.ptw_issued ?? 0,
      };
    });
  }

  /**
   * Fetch incidents with pagination and filtering.
   */
  static async getIncidents(eventId: string, opts?: {
    status?: string;
    severity?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 25;

    const where: any = { event_id: eventId };
    if (opts?.status) where.status = opts.status;
    if (opts?.severity) where.severity = opts.severity;
    if (opts?.type) where.incident_type = opts.type;

    const [incidents, total] = await Promise.all([
      prisma.safetyIncident.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          SafetyPhoto: { select: { id: true, public_url: true } },
        },
      }),
      prisma.safetyIncident.count({ where }),
    ]);

    return { incidents, total, page, pageSize };
  }

  /**
   * Upsert a daily safety log.
   */
  static async upsertLog(
    eventId: string,
    data: Record<string, any>,
    userId?: string,
    userName?: string,
  ) {
    const logDate = data.log_date ? new Date(data.log_date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    // Compute cumulative values
    const prevLogs = await prisma.safetyLog.findMany({
      where: { event_id: eventId, log_date: { lt: logDate } },
      orderBy: { log_date: 'asc' },
    });
    const prevManhours = prevLogs.reduce((s: number, l: any) => s + Number(l.manhours_worked ?? 0), 0);
    const prevLTI = prevLogs.reduce((s: number, l: any) => s + (l.lti ?? 0), 0);
    const cumManhours = prevManhours + Number(data.manhours_worked ?? 0);
    const cumLTI = prevLTI + Number(data.lti ?? 0);
    const ltiRate = cumManhours > 0 ? (cumLTI * 1_000_000) / cumManhours : 0;

    const logData = {
      manpower_planned: data.manpower_planned ?? 0,
      manpower_actual: data.manpower_actual ?? 0,
      lti: data.lti ?? 0,
      lti_days_lost: data.lti_days_lost ?? 0,
      near_miss: data.near_miss ?? 0,
      first_aid: data.first_aid ?? 0,
      medical_treatment: data.medical_treatment ?? 0,
      dangerous_occurrence: data.dangerous_occurrence ?? 0,
      ptw_issued: data.ptw_issued ?? 0,
      ptw_closed: data.ptw_closed ?? 0,
      ptw_suspended: data.ptw_suspended ?? 0,
      toolbox_talks: data.toolbox_talks ?? 0,
      manhours_worked: data.manhours_worked ?? 0,
      manhours_planned: data.manhours_planned ?? 0,
      cumulative_manhours: cumManhours,
      cumulative_lti: cumLTI,
      lti_frequency_rate: ltiRate,
      safety_notes: data.safety_notes ?? null,
    };

    return prisma.safetyLog.upsert({
      where: { event_id_log_date: { event_id: eventId, log_date: logDate } },
      create: {
        event_id: eventId,
        log_date: logDate,
        ...logData,
        submitted_by: userId ?? null,
        submitted_by_name: userName ?? null,
      },
      update: {
        ...logData,
        last_updated_by: userId ?? null,
        last_updated_by_name: userName ?? null,
      },
    });
  }
}
