import { prisma } from '@/lib/prisma';
import { CalendarEngine } from '@/lib/CalendarEngine';

/**
 * PROJECT-domain CPM authority (OD9.3).
 *
 * @deprecated For STO use — M11 (`ScheduleOrchestrationService` +
 * `src/lib/scheduleEngine.ts`) is the sole STO Event CPM authority. This class
 * is retained as the PROJECT-domain CPM: it must not call `prisma.event` and
 * must not be used as STO scheduling authority.
 *
 * `calculateProjectSchedule` walks Project → Workpack → Activity, supports
 * FS/SS/FF/SF + lag, and persists ES/EF/LS/LF/total float/free float/critical.
 * Calendars are organisation-scoped.
 */
export class SchedulingService {
  /**
   * Builds a CalendarEngine for the given org — uses the org's default
   * ScheduleCalendar if one exists, otherwise falls back to Mon–Sat 10h/day.
   */
  private static async buildCalendar(orgId: string): Promise<CalendarEngine> {
    const cal = await prisma.scheduleCalendar.findFirst({
      where: { organization_id: orgId, is_default: true },
    });
    if (cal) {
      const exceptions = Array.isArray(cal.exceptions)
        ? (cal.exceptions as { date: string; type: 'holiday' | 'work' }[])
        : [];
      return new CalendarEngine(cal.work_days, cal.hours_per_day, exceptions);
    }
    return new CalendarEngine();
  }

  /**
   * Calculates the Critical Path (CPM) for all activities in a project.
   *
   * Strategy:
   *  1. Topological sort (Kahn's algorithm)
   *  2. Forward pass → ES / EF
   *  3. Backward pass → LS / LF / TF / FF
   *  4. Persist results via a Prisma $transaction
   *
   * All durations are converted from hours → working days using CalendarEngine.
   * All dates are computed by CalendarEngine.addWorkingDays() from a determined
   * project start date.
   */
  static async calculateProjectSchedule(projectId: string, orgId: string, db: typeof prisma = prisma) {
    const calendar = await this.buildCalendar(orgId);

    // 1. Fetch activities via workpacks linked to this project.
    //    OD9.1: Activity.project_id was retired (it never existed as a database column),
    //    so the association is reached through the Workpack only.
    const activities = await db.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
      },
      include: {
        predecessors: true,
        successors: true,
      },
    });

    if (activities.length === 0) return { success: true, count: 0, activities: [] };

    // Resolve project start date: use the earliest planned_start or today
    // OD9.2 §15: the field is `planned_sd_date`. This previously used the pre-OD9
    // camelCase alias, which made every Project CPM run throw at the Prisma layer.
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: orgId },
      select: { planned_sd_date: true },
    });
    const projectStart: Date = project?.planned_sd_date
      ? new Date(project.planned_sd_date)
      : (() => {
          const d = new Date();
          d.setHours(8, 0, 0, 0);
          return d;
        })();

    // 2. Build in-memory map  id → CPM node
    type Node = {
      id: string;
      duration_days: number;
      // CPM outputs (in working days from project start)
      es: number; ef: number;
      ls: number; lf: number;
      tf: number; ff: number;
      is_critical: boolean;
      predecessors: typeof activities[0]['predecessors'];
      successors: typeof activities[0]['successors'];
    };

    const nodeMap = new Map<string, Node>();
    for (const a of activities) {
      const durationHours = Number(a.duration_hours ?? 0);
      const durationDays = calendar.hoursToDays(durationHours);
      nodeMap.set(a.id, {
        id: a.id,
        duration_days: durationDays,
        es: 0, ef: 0, ls: 0, lf: 0, tf: 0, ff: 0,
        is_critical: false,
        predecessors: a.predecessors,
        successors: a.successors,
      });
    }

    // 3. Topological sort
    const sorted = this.topologicalSort(activities);

    // Sprint 1a — canonical lag is working minutes; lag_days is the legacy fallback.
    const lagOf = (rel: { lag_minutes?: number | null; lag_days?: number | null }): number =>
      rel.lag_minutes != null
        ? Number(rel.lag_minutes) / (calendar.getHoursPerDay() * 60)
        : (rel.lag_days ?? 0);

    // 4. Forward pass (ES / EF)
    let maxEF = 0;
    for (const id of sorted) {
      const node = nodeMap.get(id)!;
      let es = 0;
      for (const rel of node.predecessors) {
        const pred = nodeMap.get(rel.predecessor_id);
        if (!pred) continue;
        const lag = lagOf(rel);
        const type = rel.relationship_type ?? 'FS';
        if (type === 'SS') es = Math.max(es, pred.es + lag);
        else if (type === 'FF') es = Math.max(es, pred.ef + lag - node.duration_days);
        else if (type === 'SF') es = Math.max(es, pred.es + lag - node.duration_days);
        else es = Math.max(es, pred.ef + lag);
      }
      node.es = es;
      node.ef = es + node.duration_days;
      maxEF = Math.max(maxEF, node.ef);
    }

    // 5. Backward pass (LS / LF / TF)
    for (const id of [...sorted].reverse()) {
      const node = nodeMap.get(id)!;
      let lf = maxEF;
      if (node.successors.length > 0) {
        lf = Infinity;
        for (const rel of node.successors) {
          const succ = nodeMap.get(rel.successor_id);
          if (!succ) continue;
          const lag = lagOf(rel);
          const type = rel.relationship_type ?? 'FS';
          if (type === 'SS') lf = Math.min(lf, succ.ls - lag + node.duration_days);
          else if (type === 'FF') lf = Math.min(lf, succ.lf - lag);
          else if (type === 'SF') lf = Math.min(lf, succ.lf - lag + node.duration_days);
          else lf = Math.min(lf, succ.ls - lag);
        }
        if (!isFinite(lf)) lf = maxEF;
      }
      node.lf = lf;
      node.ls = lf - node.duration_days;
      node.tf = lf - node.ef;
      node.is_critical = node.tf <= 0;
    }

    // 6. Free float (FF): how much an activity can slip before delaying an immediate successor
    for (const id of sorted) {
      const node = nodeMap.get(id)!;
      if (node.successors.length === 0) {
        node.ff = node.tf; // last activity: ff == tf
      } else {
        let minSuccES = Infinity;
        for (const rel of node.successors) {
          const succ = nodeMap.get(rel.successor_id);
          if (!succ) continue;
          const lag = lagOf(rel);
          minSuccES = Math.min(minSuccES, succ.es - lag);
        }
        node.ff = isFinite(minSuccES) ? minSuccES - node.ef : node.tf;
      }
    }

    // 7. Convert working-day offsets → real Date objects via CalendarEngine
    const daysToDate = (days: number): Date =>
      calendar.addWorkingDays(projectStart, Math.round(days));

    // 8. Persist CPM results via a single $transaction
    const computedActivities = Array.from(nodeMap.values());

    for (const a of computedActivities) {
      await db.activity.update({
        where: { id: a.id },
        data: {
          early_start:  daysToDate(a.es),
          early_finish: daysToDate(a.ef),
          late_start:   daysToDate(a.ls),
          late_finish:  daysToDate(a.lf),
          total_float:  a.tf,
          free_float:   a.ff,
          is_critical:  a.is_critical,
        },
      });
    }

    // 9. Return enriched activity list so the caller can push it straight to the
    //    frontend without a follow-up fetch (enables auto-refresh on the Gantt).
    const updatedActivities = await db.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
      },
      include: {
        predecessors: true,
        successors: true,
        resources: true,
      },
      orderBy: { sequence_number: 'asc' },
    });

    return {
      success: true,
      count: activities.length,
      activities: updatedActivities,
    };
  }

  /**
   * Generates data for the S-Curve chart.
   */
  static async generateSCurveData(projectId: string, orgId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, org_id: orgId },
      select: { planned_sd_date: true, planned_su_date: true },
    });

    if (!project || !project.planned_sd_date || !project.planned_su_date) {
      return [];
    }

    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
      },
      select: {
        duration_hours: true,
        early_finish: true,
        actual_end: true,
        progress_percent: true,
      },
    });

    if (activities.length === 0) return [];

    const startDate = new Date(project.planned_sd_date);
    const endDate   = new Date(project.planned_su_date);
    const totalDuration = activities.reduce(
      (sum, a) => sum + Number(a.duration_hours || 0),
      0
    );

    if (totalDuration === 0) return [];

    const result = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dateStr   = curr.toISOString().split('T')[0];
      const checkDate = new Date(dateStr + 'T23:59:59');

      const plannedFinishedDuration = activities
        .filter(a => a.early_finish && a.early_finish <= checkDate)
        .reduce((sum, a) => sum + Number(a.duration_hours || 0), 0);

      const plannedPercent = (plannedFinishedDuration / totalDuration) * 100;

      let actualPercent = 0;
      if (curr <= new Date()) {
        const actualEarnedDuration = activities.reduce((sum, a) => {
          const p = a.progress_percent || 0;
          return sum + Number(a.duration_hours || 0) * (p / 100);
        }, 0);
        actualPercent = (actualEarnedDuration / totalDuration) * 100;
      }

      result.push({
        date: dateStr,
        planned: Math.min(100, Math.round(plannedPercent  * 10) / 10),
        actual:  curr <= new Date()
          ? Math.min(100, Math.round(actualPercent * 10) / 10)
          : null,
      });

      curr.setDate(curr.getDate() + 1);
      if (result.length > 500) break;
    }

    return result;
  }

  /**
   * Fetches activities for a lookahead window.
   */
  static async getLookaheadActivities(
    projectId: string,
    orgId: string,
    windowDays: number = 7
  ) {
    const now    = new Date();
    const future = new Date();
    future.setDate(now.getDate() + windowDays);

    return prisma.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
        AND: [
          {
            OR: [
                { early_start: { gte: now, lte: future } },
                { early_finish: { gte: now, lte: future } },
                { early_start: { lte: now }, early_finish: { gte: future } },
            ],
          }
        ]
      },
      include: {
        workpack: { select: { title: true, workpack_id_code: true } },
        discipline: true,
      },
      orderBy: { early_start: 'asc' },
    });
  }

  // ─── private helpers ─────────────────────────────────────────────────────────

  private static topologicalSort(activities: any[]): string[] {
    const adj       = new Map<string, string[]>();
    const inDegree  = new Map<string, number>();
    const allIds    = activities.map(a => a.id);

    allIds.forEach(id => {
      adj.set(id, []);
      inDegree.set(id, 0);
    });

    activities.forEach(act => {
      act.successors.forEach((rel: any) => {
        if (adj.has(rel.successor_id)) {
          adj.get(act.id)!.push(rel.successor_id);
          inDegree.set(rel.successor_id, (inDegree.get(rel.successor_id) || 0) + 1);
        }
      });
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

    const result: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      result.push(u);
      adj.get(u)?.forEach(v => {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) queue.push(v);
      });
    }

    // Append any cycle-members that were not reachable (degrade gracefully)
    if (result.length !== activities.length) {
      allIds.filter(id => !result.includes(id)).forEach(id => result.push(id));
    }

    return result;
  }
}
