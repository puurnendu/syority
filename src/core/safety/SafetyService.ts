/**
 * M7.6C — Safety Service
 *
 * Centralizes safety business logic previously inline in API routes.
 * Consumed by SafetyProviders (Report Engine) and OIS widgets.
 * Pattern: Service → Prisma. Providers → Service (never raw Prisma).
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
    const where: any = { eventId };
    if (date) where.logDate = new Date(date);

    return prisma.safetyLog.findFirst({
      where,
      orderBy: { logDate: 'desc' },
      include: {
        SafetyIncident: {
          include: {
            SafetyPhoto: { select: { id: true, publicUrl: true, photoType: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        SafetyPhoto: {
          select: { id: true, publicUrl: true, photoType: true },
          orderBy: { takenAt: 'desc' },
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
        where: { eventId },
        orderBy: { logDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          SafetyIncident: { select: { id: true } },
        },
      }),
      prisma.safetyLog.count({ where: { eventId } }),
    ]);

    return {
      logs: logs.map((l) => ({
        id: l.id,
        eventId: l.eventId,
        logDate: l.logDate,
        shift: l.shift,
        manpowerPlanned: l.manpowerPlanned,
        manpowerActual: l.manpowerActual,
        lti: l.lti,
        nearMiss: l.nearMiss,
        firstAid: l.firstAid,
        medicalTreatment: l.medicalTreatment,
        dangerousOccurrence: l.dangerousOccurrence,
        manhours: Number(l.manhoursWorked ?? 0),
        ptwIssued: l.ptwIssued,
        ptwClosed: l.ptwClosed,
        toolboxTalks: l.toolboxTalks,
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
      where: { eventId },
      orderBy: { logDate: 'asc' },
      select: {
        logDate: true,
        lti: true,
        ltiDaysLost: true,
        nearMiss: true,
        firstAid: true,
        medicalTreatment: true,
        dangerousOccurrence: true,
        manhoursWorked: true,
        manhoursPlanned: true,
        manpowerPlanned: true,
        manpowerActual: true,
        ptwIssued: true,
        ptwClosed: true,
        ptwSuspended: true,
        toolboxTalks: true,
      },
    });

    const totalManhours = logs.reduce((s, l) => s + Number(l.manhoursWorked ?? 0), 0);
    const totalLTI = logs.reduce((s, l) => s + (l.lti ?? 0), 0);
    const totalNearMiss = logs.reduce((s, l) => s + (l.nearMiss ?? 0), 0);
    const totalFirstAid = logs.reduce((s, l) => s + (l.firstAid ?? 0), 0);
    const totalMedicalTreatment = logs.reduce((s, l) => s + (l.medicalTreatment ?? 0), 0);
    const totalDangerousOccurrence = logs.reduce((s, l) => s + (l.dangerousOccurrence ?? 0), 0);

    // TRIR = (Total Recordable Incidents × 200,000) / Total Manhours
    const totalRecordable = totalLTI + totalMedicalTreatment + totalDangerousOccurrence;
    const trir = totalManhours > 0 ? (totalRecordable * 200_000) / totalManhours : 0;

    // LTI Frequency Rate = (LTI × 1,000,000) / Manhours
    const ltiRate = totalManhours > 0 ? (totalLTI * 1_000_000) / totalManhours : 0;

    // Days without LTI — count from last LTI log date to today
    let daysWithoutLTI = 0;
    const lastLTILog = [...logs].reverse().find((l) => l.lti > 0);
    if (lastLTILog) {
      daysWithoutLTI = Math.floor(
        (Date.now() - new Date(lastLTILog.logDate).getTime()) / 86_400_000
      );
    } else if (logs.length > 0) {
      daysWithoutLTI = Math.floor(
        (Date.now() - new Date(logs[0].logDate).getTime()) / 86_400_000
      );
    }

    return {
      totalManhours,
      totalManhoursPlanned: logs.reduce((s, l) => s + Number(l.manhoursPlanned ?? 0), 0),
      totalLTI,
      ltiFrequencyRate: Math.round(ltiRate * 100) / 100,
      totalNearMiss,
      totalFirstAid,
      totalMedicalTreatment,
      totalDangerousOccurrence,
      totalPtwIssued: logs.reduce((s, l) => s + (l.ptwIssued ?? 0), 0),
      totalPtwClosed: logs.reduce((s, l) => s + (l.ptwClosed ?? 0), 0),
      totalPtwSuspended: logs.reduce((s, l) => s + (l.ptwSuspended ?? 0), 0),
      totalToolboxTalks: logs.reduce((s, l) => s + (l.toolboxTalks ?? 0), 0),
      totalManpowerPlanned: logs.reduce((s, l) => s + (l.manpowerPlanned ?? 0), 0),
      totalManpowerActual: logs.reduce((s, l) => s + (l.manpowerActual ?? 0), 0),
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
    const where: any = { eventId };
    if (opts?.dateFrom || opts?.dateTo) {
      where.logDate = {};
      if (opts?.dateFrom) where.logDate.gte = new Date(opts.dateFrom);
      if (opts?.dateTo) where.logDate.lte = new Date(opts.dateTo);
    }

    const logs = await prisma.safetyLog.findMany({
      where,
      orderBy: { logDate: 'asc' },
    });

    return logs.map((l) => {
      const manhours = Number(l.manhoursWorked ?? 0);
      const cumManhours = Number(l.cumulativeManhours ?? 0);
      const cumLti = l.cumulativeLti ?? 0;
      const totalRecordable = (l.lti ?? 0) + (l.medicalTreatment ?? 0) + (l.dangerousOccurrence ?? 0);
      const trir = cumManhours > 0 ? (totalRecordable * 200_000) / cumManhours : 0;

      return {
        date: l.logDate.toISOString().split('T')[0],
        manhours,
        lti: l.lti ?? 0,
        nearMiss: l.nearMiss ?? 0,
        firstAid: l.firstAid ?? 0,
        medicalTreatment: l.medicalTreatment ?? 0,
        cumulativeManhours: cumManhours,
        cumulativeLti: cumLti,
        ltiRate: Number(l.ltiFrequencyRate ?? 0),
        trir: Math.round(trir * 100) / 100,
        manpowerActual: l.manpowerActual ?? 0,
        ptwIssued: l.ptwIssued ?? 0,
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

    const where: any = { eventId };
    if (opts?.status) where.status = opts.status;
    if (opts?.severity) where.severity = opts.severity;
    if (opts?.type) where.incidentType = opts.type;

    const [incidents, total] = await Promise.all([
      prisma.safetyIncident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          SafetyPhoto: { select: { id: true, publicUrl: true } },
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
      where: { eventId, logDate: { lt: logDate } },
      orderBy: { logDate: 'asc' },
    });
    const prevManhours = prevLogs.reduce((s, l) => s + Number(l.manhoursWorked ?? 0), 0);
    const prevLTI = prevLogs.reduce((s, l) => s + (l.lti ?? 0), 0);
    const cumManhours = prevManhours + Number(data.manhours_worked ?? 0);
    const cumLTI = prevLTI + Number(data.lti ?? 0);
    const ltiRate = cumManhours > 0 ? (cumLTI * 1_000_000) / cumManhours : 0;

    const logData = {
      manpowerPlanned: data.manpower_planned ?? 0,
      manpowerActual: data.manpower_actual ?? 0,
      lti: data.lti ?? 0,
      ltiDaysLost: data.lti_days_lost ?? 0,
      nearMiss: data.near_miss ?? 0,
      firstAid: data.first_aid ?? 0,
      medicalTreatment: data.medical_treatment ?? 0,
      dangerousOccurrence: data.dangerous_occurrence ?? 0,
      ptwIssued: data.ptw_issued ?? 0,
      ptwClosed: data.ptw_closed ?? 0,
      ptwSuspended: data.ptw_suspended ?? 0,
      toolboxTalks: data.toolbox_talks ?? 0,
      manhoursWorked: data.manhours_worked ?? 0,
      manhoursPlanned: data.manhours_planned ?? 0,
      cumulativeManhours: cumManhours,
      cumulativeLti: cumLTI,
      ltiFrequencyRate: ltiRate,
      safetyNotes: data.safety_notes ?? null,
    };

    return prisma.safetyLog.upsert({
      where: { eventId_logDate: { eventId, logDate } },
      create: {
        eventId,
        logDate,
        ...logData,
        submittedBy: userId ?? null,
        submittedByName: userName ?? null,
      },
      update: {
        ...logData,
        lastUpdatedBy: userId ?? null,
        lastUpdatedByName: userName ?? null,
      },
    });
  }
}
