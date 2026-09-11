import { prisma } from '@/lib/prisma';
import { PermitService } from '@/modules/Permits/Services/PermitService';

export interface ExecutionSummaryDTO {
  total_workpacks: number;
  activities_planned_today: number;
  activities_in_progress: number;
  activities_completed: number;
  delayed_activities: number;
  open_constraints: number;
  total_manpower: number;
  total_manhours: number;
  overall_progress: number;
  open_hold_points: number;
  safety_incidents: number;
}

export interface ActivityExecutionDTO {
  id: string;
  activity_number: string | null;
  description: string;
  wbs_code: string | null;
  workpack_id: string | null;
  workpack_number: string | null;
  workpack_title: string | null;
  workpack_status: string | null;
  unit_code: string | null;
  discipline_name: string | null;
  discipline_color: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  duration_hours: number;
  progress_percent: number;
  status: string;
  total_float: number | null;
  is_critical: boolean;
  responsible: string | null;
  hold_point_type: string | null;
  hold_point_description: string | null;
  has_hold_point: boolean;
  hold_point_cleared: boolean;
  open_constraints_count: number;
  delay_reason: string | null;
  // M8.7 Phase 2C Execution Control
  is_ready_to_start?: boolean;
  blocking_reasons?: string[];
  permit_status?: string;
  critical_constraints_count?: number;
}

export interface LookaheadItemDTO extends ActivityExecutionDTO {
  categories: ('STARTING' | 'CONTINUING' | 'FINISHING' | 'OVERDUE' | 'BLOCKED' | 'CRITICAL')[];
}

export interface PlanVsActualDTO {
  id: string;
  activity_number: string | null;
  description: string;
  workpack_id: string | null;
  workpack_number: string | null;
  discipline_name: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  duration_hours: number;
  actual_duration_hours: number;
  progress_percent: number;
  status: string;
  start_variance_hours: number | null;
  finish_variance_hours: number | null;
  duration_variance_hours: number | null;
  total_float: number | null;
  is_critical: boolean;
  is_delayed: boolean;
}

export class FieldExecutionService {
  /**
   * Calculates overall duration-weighted progress.
   * 
   * @deprecated M8.13 Phase 2 — Use ProgressCalculationService.calculateProgressMetrics() instead.
   * This method is kept for backward compatibility and delegates to the authoritative engine.
   */
  static calculateWeightedProgress(activities: { duration_hours?: any; progress_percent?: any; status?: any }[]): number {
    if (!activities || activities.length === 0) return 0;

    // Delegate to authoritative ProgressCalculationService
    const { calculateProgressMetrics } = require('@/core/progress/ProgressCalculationService');
    const inputs = activities.map((act, i) => ({
      activityId: `legacy-${i}`,
      durationHours: act.duration_hours != null ? Number(act.duration_hours) : null,
      progressPercent: act.progress_percent != null ? Number(act.progress_percent) : null,
      status: act.status ?? null,
      workpackId: null,
      eventId: null,
    }));
    return calculateProgressMetrics(inputs).weightedProgress;
  }

  /**
   * Retrieves high-level execution summary KPIs
   */
  static async getExecutionSummary(orgId: string, eventId?: string): Promise<ExecutionSummaryDTO> {
    const whereEvent = eventId ? { event_id: eventId } : {};

    const [
      workpacks,
      activities,
      openConstraints,
      safetyLogs,
      safetyIncidents,
      qaClearances,
    ] = await Promise.all([
      prisma.workpack.findMany({
        where: { organization_id: orgId, deleted_at: null, ...whereEvent },
        select: { id: true, overall_progress: true, status: true },
      }),
      prisma.activity.findMany({
        where: { organization_id: orgId, deleted_at: null, ...whereEvent },
        select: {
          id: true,
          planned_start: true,
          planned_end: true,
          actual_start: true,
          actual_end: true,
          duration_hours: true,
          progress_percent: true,
          status: true,
          hold_point_type: true,
          total_float: true,
          is_critical: true,
        },
      }),
      prisma.constraintLog.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { in: ['open', 'in_progress'] },
          ...(eventId ? { workpack: { event_id: eventId } } : {}),
        },
      }),
      prisma.safetyLog.findMany({
        where: { ...(eventId ? { event_id: eventId } : {}) },
        select: { manpower_actual: true, manhours_worked: true },
      }),
      prisma.safetyIncident.count({
        where: { ...(eventId ? { event_id: eventId } : {}), status: { not: 'Closed' } },
      }),
      prisma.qa_clearance_records.findMany({
        where: { organization_id: orgId },
        select: { activity_id: true },
      }),
    ]);

    const clearedActivityIds = new Set(qaClearances.map((q) => q.activity_id));
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let plannedToday = 0;
    let inProgress = 0;
    let completed = 0;
    let delayed = 0;
    let openHoldPoints = 0;

    for (const act of activities) {
      const pStart = act.planned_start ? act.planned_start.toISOString().slice(0, 10) : null;
      const pEnd = act.planned_end ? act.planned_end.toISOString().slice(0, 10) : null;
      const aStart = act.actual_start ? act.actual_start.toISOString().slice(0, 10) : null;
      const prog = act.progress_percent ?? 0;
      const stat = act.status ?? 'not_started';

      if (pStart === todayStr || pEnd === todayStr || (pStart && pEnd && pStart <= todayStr && pEnd >= todayStr)) {
        plannedToday++;
      }

      if (stat === 'in_progress' || (prog > 0 && prog < 100)) {
        inProgress++;
      } else if (stat === 'completed' || prog === 100) {
        completed++;
      }

      // Check delayed
      if (prog < 100) {
        if (pEnd && pEnd < todayStr) {
          delayed++;
        } else if (pStart && aStart && aStart > pStart) {
          delayed++;
        }
      }

      // Check open hold points
      if (act.hold_point_type && !clearedActivityIds.has(act.id)) {
        openHoldPoints++;
      }
    }

    let totalManpower = 0;
    let totalManhours = 0;
    for (const s of safetyLogs) {
      totalManpower += s.manpower_actual || 0;
      totalManhours += Number(s.manhours_worked || 0);
    }

    const overallProgress = this.calculateWeightedProgress(activities);

    return {
      total_workpacks: workpacks.length,
      activities_planned_today: plannedToday,
      activities_in_progress: inProgress,
      activities_completed: completed,
      delayed_activities: delayed,
      open_constraints: openConstraints,
      total_manpower: totalManpower,
      total_manhours: Math.round(totalManhours),
      overall_progress: overallProgress,
      open_hold_points: openHoldPoints,
      safety_incidents: safetyIncidents,
    };
  }

  /**
   * Retrieves today's execution board activities
   */
  static async getExecutionBoard(orgId: string, eventId?: string): Promise<ActivityExecutionDTO[]> {
    const whereEvent = eventId ? { event_id: eventId } : {};

    const [activities, qaClearances, constraints, permits] = await Promise.all([
      prisma.activity.findMany({
        where: {
            organization_id: orgId,
            deleted_at: null,
            ...whereEvent,
            workpack: { status: { in: ['issued', 'in_execution'] } }
        },
        include: {
          workpack: { select: { id: true, workpack_number: true, workpack_id_code: true, title: true, unit_code: true, status: true } },
          discipline: { select: { name: true, color: true } },
          predecessors: { include: { predecessor: { select: { id: true, status: true, activity_number: true } } } }
        },
        orderBy: [{ sequence_number: 'asc' }, { planned_start: 'asc' }],
      }),
      prisma.qa_clearance_records.findMany({
        where: { organization_id: orgId },
        select: { activity_id: true },
      }),
      prisma.constraintLog.findMany({
        where: { organization_id: orgId, deleted_at: null, status: { in: ['open', 'in_progress'] } },
        select: { workpack_id: true, description: true, severity: true },
      }),
      prisma.permit.findMany({
        where: { organization_id: orgId, status: { not: 'closed' } },
        select: { id: true, workpack_id: true, activity_id: true, status: true, valid_until: true, permit_number: true }
      })
    ]);

    const clearedActivityIds = new Set(qaClearances.map((q) => q.activity_id));
    const constraintsByWp = new Map<string, any[]>();
    for (const c of constraints) {
      const arr = constraintsByWp.get(c.workpack_id || '') || [];
      arr.push(c);
      constraintsByWp.set(c.workpack_id || '', arr);
    }
    
    const permitsByWp = new Map<string, any[]>();
    const permitsByAct = new Map<string, any[]>();
    for (const p of permits) {
      if (p.workpack_id) {
        const arr = permitsByWp.get(p.workpack_id) || [];
        arr.push(p);
        permitsByWp.set(p.workpack_id, arr);
      }
      if (p.activity_id) {
        const arr = permitsByAct.get(p.activity_id) || [];
        arr.push(p);
        permitsByAct.set(p.activity_id, arr);
      }
    }

    return activities.map((act) => {
      const wpId = act.workpack_id;
      const wpConstraints = wpId ? constraintsByWp.get(wpId) || [] : [];
      const hasHoldPoint = Boolean(act.hold_point_type);
      const isCleared = clearedActivityIds.has(act.id);
      
      const blockingReasons: string[] = [];
      const criticalConstraints = wpConstraints.filter(c => c.severity === 'critical');
      if (criticalConstraints.length > 0) {
        blockingReasons.push(`${criticalConstraints.length} critical constraint(s) open`);
      }
      
      const incompletePredecessors = act.predecessors.filter(p => p.predecessor.status !== 'completed');
      if (incompletePredecessors.length > 0) {
        blockingReasons.push(`Waiting on ${incompletePredecessors.length} predecessor(s)`);
      }
      
      const wpPermits = wpId ? permitsByWp.get(wpId) || [] : [];
      const actPermits = permitsByAct.get(act.id) || [];
      const allPermits = [...wpPermits, ...actPermits];
      let permitStatus = 'None Required';
      if (allPermits.length > 0) {
        const missingOrExpired = allPermits.filter(p => {
          if (p.status !== 'issued') return true;
          if (p.valid_until && new Date(p.valid_until) < new Date()) return true;
          return false;
        });
        if (missingOrExpired.length > 0) {
          permitStatus = 'Missing/Expired';
          blockingReasons.push(`${missingOrExpired.length} required permit(s) missing or expired`);
        } else {
          permitStatus = 'Issued';
        }
      }

      return {
        id: act.id,
        activity_number: act.activity_number || act.activity_id || null,
        description: act.description,
        wbs_code: act.wbs_code || null,
        workpack_id: act.workpack?.id || null,
        workpack_number: act.workpack?.workpack_number || act.workpack?.workpack_id_code || null,
        workpack_title: act.workpack?.title || null,
        workpack_status: act.workpack?.status || null,
        unit_code: act.workpack?.unit_code || null,
        discipline_name: act.discipline?.name || null,
        discipline_color: act.discipline?.color || '#3B82F6',
        planned_start: act.planned_start ? act.planned_start.toISOString().slice(0, 10) : null,
        planned_end: act.planned_end ? act.planned_end.toISOString().slice(0, 10) : null,
        actual_start: act.actual_start ? act.actual_start.toISOString().slice(0, 10) : null,
        actual_end: act.actual_end ? act.actual_end.toISOString().slice(0, 10) : null,
        duration_hours: Number(act.duration_hours ?? 8),
        progress_percent: act.progress_percent ?? 0,
        status: String(act.status || 'not_started'),
        total_float: act.total_float !== null ? Number(act.total_float) : null,
        is_critical: Boolean(act.is_critical),
        responsible: act.responsible || null,
        hold_point_type: act.hold_point_type || null,
        hold_point_description: act.hold_point_description || null,
        has_hold_point: hasHoldPoint,
        hold_point_cleared: isCleared,
        open_constraints_count: wpConstraints.length,
        delay_reason: wpConstraints[0]?.description || null,
        is_ready_to_start: blockingReasons.length === 0,
        blocking_reasons: blockingReasons,
        permit_status: permitStatus,
        critical_constraints_count: criticalConstraints.length,
      };
    });
  }

  private static async verifyExecutionPrerequisites(orgId: string, activity: any) {
    // 1. Check for open critical constraints
    const criticalConstraints = await prisma.constraintLog.count({
      where: {
        organization_id: orgId,
        workpack_id: activity.workpack_id,
        severity: 'critical',
        status: { in: ['open', 'in_progress'] },
        deleted_at: null,
      },
    });

    if (criticalConstraints > 0) {
      throw new Error(`Execution blocked: Workpack has open critical constraints.`);
    }

    // 2. Check for dependencies (predecessors)
    const predecessors = await prisma.activityRelationship.findMany({
      where: {
        successor_id: activity.id,
      },
      include: {
        predecessor: true,
      }
    });

    const incompletePredecessors = predecessors.filter(p => p.predecessor && p.predecessor.status !== 'completed');
    if (incompletePredecessors.length > 0) {
      const deps = incompletePredecessors.map(p => p.predecessor.activity_number || p.predecessor.description).join(', ');
      throw new Error(`Execution blocked: Predecessor activities must be completed (${deps}).`);
    }

    // 3. Check for permits
    if (activity.workpack_id) {
      const permitCheck = await PermitService.validatePermitsForExecution(orgId, activity.workpack_id, activity.id);
      if (!permitCheck.isValid) {
        throw new Error(`Execution blocked: ${permitCheck.blockers.join(' ')}`);
      }
    }
  }


  /**
   * Recalculates and stores overall_progress on Workpack
   */
  static async syncWorkpackProgress(orgId: string, workpackId: string) {
    const activities = await prisma.activity.findMany({
      where: { 
        organization_id: orgId, 
        workpack_id: workpackId, 
        deleted_at: null,
        status: { not: 'cancelled' }
      },
      select: { duration_hours: true, progress_percent: true },
    });

    const wpProgress = this.calculateWeightedProgress(activities);

    await prisma.workpack.update({
      where: { id: workpackId },
      data: { overall_progress: wpProgress },
    });
  }

  /**
   * Unified 24h / 72h Lookahead Engine
   */
  static async getLookahead(
    orgId: string,
    eventId?: string,
    hours: number = 24,
    filters?: {
      discipline_id?: string;
      critical_only?: boolean;
      delayed_only?: boolean;
    }
  ): Promise<LookaheadItemDTO[]> {
    const boardItems = await this.getExecutionBoard(orgId, eventId);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const nowStr = now.toISOString().slice(0, 10);
    const windowEndStr = windowEnd.toISOString().slice(0, 10);

    const results: LookaheadItemDTO[] = [];

    for (const item of boardItems) {
      const categories: ('STARTING' | 'CONTINUING' | 'FINISHING' | 'OVERDUE' | 'BLOCKED' | 'CRITICAL')[] = [];

      const pStart = item.planned_start;
      const pEnd = item.planned_end;
      const prog = item.progress_percent;
      const stat = item.status;

      // 1. STARTING
      if (stat === 'not_started' && pStart && pStart >= nowStr && pStart <= windowEndStr) {
        categories.push('STARTING');
      }

      // 2. CONTINUING
      if (stat === 'in_progress' || (prog > 0 && prog < 100)) {
        categories.push('CONTINUING');
      }

      // 3. FINISHING
      if (pEnd && pEnd >= nowStr && pEnd <= windowEndStr && prog < 100) {
        categories.push('FINISHING');
      }

      // 4. OVERDUE
      if (pEnd && pEnd < nowStr && prog < 100) {
        categories.push('OVERDUE');
      }

      // 5. BLOCKED
      if (item.open_constraints_count > 0 || (item.has_hold_point && !item.hold_point_cleared)) {
        categories.push('BLOCKED');
      }

      // 6. CRITICAL
      if (item.is_critical || (item.total_float !== null && item.total_float <= 0)) {
        categories.push('CRITICAL');
      }

      // Include if it matches any lookahead category or is active in window
      if (categories.length > 0) {
        if (filters?.critical_only && !categories.includes('CRITICAL')) continue;
        if (filters?.delayed_only && !categories.includes('OVERDUE')) continue;

        results.push({
          ...item,
          categories,
        });
      }
    }

    return results;
  }

  /**
   * Plan vs Actual Variance Engine
   */
  static async getPlanVsActual(orgId: string, eventId?: string): Promise<PlanVsActualDTO[]> {
    const activities = await prisma.activity.findMany({
      where: { organization_id: orgId, deleted_at: null, ...(eventId ? { event_id: eventId } : {}) },
      include: {
        workpack: { select: { id: true, workpack_number: true, workpack_id_code: true } },
        discipline: { select: { name: true } },
      },
      orderBy: [{ planned_start: 'asc' }, { sequence_number: 'asc' }],
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return activities.map((act) => {
      const pStart = act.planned_start ? new Date(act.planned_start) : null;
      const pEnd = act.planned_end ? new Date(act.planned_end) : null;
      const aStart = act.actual_start ? new Date(act.actual_start) : null;
      const aEnd = act.actual_end ? new Date(act.actual_end) : null;

      let startVarHours: number | null = null;
      if (pStart && aStart) {
        startVarHours = Math.round((aStart.getTime() - pStart.getTime()) / (1000 * 60 * 60));
      }

      let finishVarHours: number | null = null;
      if (pEnd && aEnd) {
        finishVarHours = Math.round((aEnd.getTime() - pEnd.getTime()) / (1000 * 60 * 60));
      }

      const durPlanned = Number(act.duration_hours ?? 8);
      let durActual = durPlanned;
      if (aStart && aEnd) {
        durActual = Math.max(1, Math.round((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60)));
      }
      const durVarHours = durActual - durPlanned;

      const pEndStr = act.planned_end ? act.planned_end.toISOString().slice(0, 10) : null;
      const prog = act.progress_percent ?? 0;
      const isDelayed = (startVarHours !== null && startVarHours > 0) || (finishVarHours !== null && finishVarHours > 0) || (Boolean(pEndStr && pEndStr < todayStr && prog < 100));

      return {
        id: act.id,
        activity_number: act.activity_number || act.activity_id || null,
        description: act.description,
        workpack_id: act.workpack_id,
        workpack_number: act.workpack?.workpack_id_code || act.workpack?.workpack_number || null,
        discipline_name: act.discipline?.name || null,
        planned_start: act.planned_start ? act.planned_start.toISOString().slice(0, 10) : null,
        planned_end: act.planned_end ? act.planned_end.toISOString().slice(0, 10) : null,
        actual_start: act.actual_start ? act.actual_start.toISOString().slice(0, 10) : null,
        actual_end: act.actual_end ? act.actual_end.toISOString().slice(0, 10) : null,
        duration_hours: durPlanned,
        actual_duration_hours: durActual,
        progress_percent: prog,
        status: String(act.status || 'not_started'),
        start_variance_hours: startVarHours,
        finish_variance_hours: finishVarHours,
        duration_variance_hours: durVarHours,
        total_float: act.total_float !== null ? Number(act.total_float) : null,
        is_critical: Boolean(act.is_critical),
        is_delayed: isDelayed,
      };
    });
  }

  /**
   * Generates Daily Shift Handover & Daily Execution Report
   */
  static async generateDailyExecutionReport(orgId: string, eventId: string, dateStr: string, shiftType: string) {
    const [summary, board, lookahead24, lookahead72, safetyLogs, constraints] = await Promise.all([
      this.getExecutionSummary(orgId, eventId),
      this.getExecutionBoard(orgId, eventId),
      this.getLookahead(orgId, eventId, 24),
      this.getLookahead(orgId, eventId, 72),
      prisma.safetyLog.findMany({
        where: { event_id: eventId },
        orderBy: { log_date: 'desc' },
        take: 5,
      }),
      prisma.constraintLog.findMany({
        where: { organization_id: orgId, deleted_at: null, status: { in: ['open', 'in_progress'] } },
        include: { workpack: { select: { workpack_id_code: true, title: true } } },
      }),
    ]);

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { site: true },
    });

    return {
      header: {
        site_name: event?.site?.name || 'Refinery Complex',
        event_name: event?.name || 'Turnaround Event',
        event_code: event?.code || 'TA-2026',
        report_date: dateStr,
        shift_type: shiftType.toUpperCase(),
        generated_at: new Date().toISOString(),
      },
      summary,
      activities: {
        total: board.length,
        in_progress: board.filter((b) => b.status === 'in_progress'),
        completed: board.filter((b) => b.status === 'completed'),
        delayed: board.filter((b) => b.delay_reason || (b.planned_end && b.planned_end < dateStr && b.progress_percent < 100)),
      },
      delays: constraints.map((c) => ({
        id: c.id,
        number: c.constraint_number,
        title: c.title,
        description: c.description,
        category: c.category,
        severity: c.severity,
        workpack: c.workpack?.workpack_id_code || c.workpack?.title,
      })),
      safety: safetyLogs[0] || null,
      lookahead: {
        next_24h_count: lookahead24.length,
        next_72h_count: lookahead72.length,
        critical_items: lookahead72.filter((l) => l.categories.includes('CRITICAL')),
      },
    };
  }
}
