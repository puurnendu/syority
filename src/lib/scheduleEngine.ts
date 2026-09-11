/**
 * SYORITY CPM Schedule Engine
 *
 * Pure deterministic scheduling service implementing the Critical Path Method (CPM),
 * Topological Sorting (Kahn's Algorithm), Cycle Detection, Forward Pass, Backward Pass,
 * Total/Free Float calculation, and Critical Path identification.
 */

import type { CalendarEngine } from './CalendarEngine';

export type RelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

export interface ScheduleActivityInput {
  id: string;
  activity_number?: string | null;
  description: string;
  duration_hours: number | string;
  planned_start?: string | Date | null;
  planned_end?: string | Date | null;
  wbs_code?: string | null;
  status?: string | null;
  discipline_id?: string | null;
  actual_start?: string | Date | null;
  actual_end?: string | Date | null;
  progress?: number | null;
}

export interface ScheduleRelationshipInput {
  id?: string;
  predecessor_id: string;
  successor_id: string;
  relationship_type?: RelationshipType | null;
  /** Legacy whole-day lag. Read fallback only. */
  lag_days?: number | null;
  /** Sprint 1a — canonical lag in working minutes (sub-day capable). */
  lag_minutes?: number | null;
}

export interface ScheduleCalculationOptions {
  project_start_date?: string | Date;
  target_finish_date?: string | Date;
  working_hours_per_day?: number; // default: 8 (or 24 for 24x7 turnaround)
  critical_float_threshold?: number; // default: 0 days
  /**
   * Sprint 1a (audit §7.4) — when provided, offsets are converted to dates in
   * WORKING days (weekends/holidays/exceptions skipped) instead of naive 24h
   * arithmetic. When omitted, behaviour is unchanged (legacy calendar-blind).
   */
  calendar?: CalendarEngine | null;
}

export interface CalculatedActivity {
  id: string;
  activity_number?: string | null;
  description: string;
  wbs_code?: string | null;
  duration_hours: number;
  duration_days: number;
  early_start: string; // ISO timestamp (time-of-day preserved)
  early_finish: string; // ISO timestamp (time-of-day preserved)
  late_start: string; // ISO timestamp (time-of-day preserved)
  late_finish: string; // ISO timestamp (time-of-day preserved)
  total_float_days: number;
  total_float_hours: number;
  free_float_days: number;
  is_critical: boolean;
  predecessors: {
    activity_id: string;
    type: RelationshipType;
    lag_days: number;
  }[];
  successors: {
    activity_id: string;
    type: RelationshipType;
    lag_days: number;
  }[];
  actual_start?: string | null;
  actual_end?: string | null;
  progress?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
}

export interface ScheduleWarning {
  code: string;
  activity_id?: string;
  message: string;
}

export interface ScheduleCalculationResult {
  success: boolean;
  error?: string;
  cycle_detected?: boolean;
  cycle_node_ids?: string[];
  project_start: string;
  project_finish: string;
  total_duration_days: number;
  total_duration_hours: number;
  critical_path_ids: string[];
  activities: CalculatedActivity[];
  warnings: ScheduleWarning[];
}

/**
 * Helper to add days to a Date object
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}

/**
 * Helper to get day difference between two Dates
 */
function diffDays(d2: Date, d1: Date): number {
  return (d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Main Schedule Calculation Engine
 */
export function calculateSchedule(
  activities: ScheduleActivityInput[],
  relationships: ScheduleRelationshipInput[],
  options: ScheduleCalculationOptions = {}
): ScheduleCalculationResult {
  const warnings: ScheduleWarning[] = [];
  const hoursPerDay = options.working_hours_per_day && options.working_hours_per_day > 0 ? options.working_hours_per_day : 8;
  const floatThreshold = options.critical_float_threshold ?? 0;
  const calendar = options.calendar ?? null;

  /** Lag in day-offset units: canonical minutes → working days via the
   *  calendar's hours/day; legacy lag_days read as-is. */
  const lagToDays = (rel: ScheduleRelationshipInput): number => {
    if (rel.lag_minutes != null) return Number(rel.lag_minutes) / (hoursPerDay * 60);
    return Number(rel.lag_days) || 0;
  };

  if (!activities || activities.length === 0) {
    const defaultStart = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      project_start: defaultStart,
      project_finish: defaultStart,
      total_duration_days: 0,
      total_duration_hours: 0,
      critical_path_ids: [],
      activities: [],
      warnings: [],
    };
  }

  // 1. Build Index & Adjacency Lists
  const activityMap = new Map<string, ScheduleActivityInput>();
  const durationDaysMap = new Map<string, number>();
  const inEdges = new Map<string, { predId: string; type: RelationshipType; lag: number }[]>();
  const outEdges = new Map<string, { succId: string; type: RelationshipType; lag: number }[]>();
  const inDegree = new Map<string, number>();

  activities.forEach((act) => {
    activityMap.set(act.id, act);
    const durHours = Math.max(0, Number(act.duration_hours) || 0);
    const durDays = durHours === 0 ? 0 : Math.max(0.1, durHours / hoursPerDay);
    durationDaysMap.set(act.id, durDays);
    inEdges.set(act.id, []);
    outEdges.set(act.id, []);
    inDegree.set(act.id, 0);
  });

  // Filter valid relationships (both predecessor and successor must exist)
  relationships.forEach((rel) => {
    if (!activityMap.has(rel.predecessor_id) || !activityMap.has(rel.successor_id)) {
      warnings.push({
        code: 'INVALID_RELATIONSHIP',
        message: `Relationship between ${rel.predecessor_id} and ${rel.successor_id} references a missing activity.`,
      });
      return;
    }

    if (rel.predecessor_id === rel.successor_id) {
      warnings.push({
        code: 'SELF_DEPENDENCY',
        activity_id: rel.predecessor_id,
        message: `Activity ${rel.predecessor_id} cannot depend on itself.`,
      });
      return;
    }

    const type: RelationshipType = rel.relationship_type || 'FS';
    const lag = lagToDays(rel);

    outEdges.get(rel.predecessor_id)!.push({ succId: rel.successor_id, type, lag });
    inEdges.get(rel.successor_id)!.push({ predId: rel.predecessor_id, type, lag });
    inDegree.set(rel.successor_id, (inDegree.get(rel.successor_id) || 0) + 1);
  });

  // 2. Cycle Detection (Kahn's Algorithm for Topological Sort)
  const queue: string[] = [];
  const topologicalOrder: string[] = [];
  const inDegreeCopy = new Map(inDegree);

  inDegreeCopy.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  while (queue.length > 0) {
    const u = queue.shift()!;
    topologicalOrder.push(u);

    outEdges.get(u)?.forEach(({ succId }) => {
      const remaining = inDegreeCopy.get(succId)! - 1;
      inDegreeCopy.set(succId, remaining);
      if (remaining === 0) queue.push(succId);
    });
  }

  if (topologicalOrder.length < activities.length) {
    // Cycle Detected
    const cycleNodes = activities
      .map((a) => a.id)
      .filter((id) => (inDegreeCopy.get(id) || 0) > 0);

    return {
      success: false,
      error: 'SCHEDULE_CYCLE_DETECTED',
      cycle_detected: true,
      cycle_node_ids: cycleNodes,
      project_start: '',
      project_finish: '',
      total_duration_days: 0,
      total_duration_hours: 0,
      critical_path_ids: [],
      activities: [],
      warnings: [
        {
          code: 'SCHEDULE_CYCLE_DETECTED',
          message: `Circular dependency detected among ${cycleNodes.length} activities.`,
        },
      ],
    };
  }

  // 3. Resolve Project Start Reference Date
  let projectStartDate: Date;
  if (options.project_start_date) {
    projectStartDate = new Date(options.project_start_date);
  } else {
    // Look for minimum planned_start or fallback to today
    let minDate: Date | null = null;
    activities.forEach((act) => {
      if (act.planned_start) {
        const d = new Date(act.planned_start);
        if (!isNaN(d.getTime())) {
          if (!minDate || d < minDate) minDate = d;
        }
      }
    });
    projectStartDate = minDate || new Date();
  }

  // Sprint 1a (audit §7.4): with a calendar, work cannot start on a
  // non-working day — roll the reference date forward to the next working day.
  if (calendar) {
    while (!calendar.isWorkingDay(projectStartDate)) {
      projectStartDate.setDate(projectStartDate.getDate() + 1);
    }
  }

  /**
   * Offset (working days) → calendar timestamp. Whole days step through the
   * working calendar; the fractional remainder is kept as time-of-day so a
   * 14:00 finish stays 14:00 (Sprint 1b / A6). Without a calendar: legacy
   * naive 24h arithmetic.
   */
  const offsetToDate = (offset: number): Date => {
    if (!calendar) return addDays(projectStartDate, offset);
    const whole = Math.floor(offset);
    const frac = offset - whole;
    const landed = calendar.addWorkingDays(projectStartDate, whole);
    return new Date(landed.getTime() + frac * 24 * 60 * 60 * 1000);
  };

  /** Wall-clock timestamp → day offset from project start (preserves time). */
  const dateToOffset = (d: Date): number => {
    return (d.getTime() - projectStartDate.getTime()) / (24 * 60 * 60 * 1000);
  };

  const asBuiltFinishOffset = (predId: string, computedEf: number): number => {
    const pred = activityMap.get(predId);
    if (pred?.actual_end) {
      const actual = new Date(pred.actual_end);
      if (!Number.isNaN(actual.getTime())) return dateToOffset(actual);
    }
    return computedEf;
  };

  // 4. Forward Pass (Calculate Early Start & Early Finish in offsets)
  const esDaysMap = new Map<string, number>();
  const efDaysMap = new Map<string, number>();

  topologicalOrder.forEach((id) => {
    const dur = durationDaysMap.get(id)!;
    const preds = inEdges.get(id)!;

    if (preds.length === 0) {
      // Activity with no predecessors: starts at day offset 0 (or its planned_start diff)
      const act = activityMap.get(id)!;
      let startOffset = 0;
      if (act.planned_start) {
        const pDate = new Date(act.planned_start);
        if (!isNaN(pDate.getTime())) {
          if (calendar) {
            // Anchor in working days; a planned start on a non-working day
            // rolls forward to the next working day.
            while (!calendar.isWorkingDay(pDate)) {
              pDate.setDate(pDate.getDate() + 1);
            }
            startOffset = Math.max(0, calendar.workingDaysBetween(projectStartDate, pDate));
          } else {
            startOffset = Math.max(0, diffDays(pDate, projectStartDate));
          }
        }
      }
      esDaysMap.set(id, startOffset);
      efDaysMap.set(id, startOffset + dur);
    } else {
      let maxEarlyStart = 0;

      preds.forEach(({ predId, type, lag }) => {
        const predES = esDaysMap.get(predId) || 0;
        const predEF = asBuiltFinishOffset(predId, efDaysMap.get(predId) || 0);

        let candidateES = 0;
        if (type === 'FS') {
          candidateES = predEF + lag;
        } else if (type === 'SS') {
          candidateES = predES + lag;
        } else if (type === 'FF') {
          candidateES = predEF + lag - dur;
        } else if (type === 'SF') {
          candidateES = predES + lag - dur;
        }

        if (candidateES > maxEarlyStart) {
          maxEarlyStart = candidateES;
        }
      });

      esDaysMap.set(id, Math.max(0, maxEarlyStart));
      efDaysMap.set(id, Math.max(0, maxEarlyStart) + dur);
    }
  });

  // Calculate Project Finish Offset
  let maxProjectFinishOffset = 0;
  efDaysMap.forEach((ef) => {
    if (ef > maxProjectFinishOffset) maxProjectFinishOffset = ef;
  });

  // 5. Backward Pass (Calculate Late Finish & Late Start)
  const lsDaysMap = new Map<string, number>();
  const lfDaysMap = new Map<string, number>();

  // Determine late finish base for sinks (using target_finish_date if provided)
  let baseLateFinishOffset = maxProjectFinishOffset;
  if (options.target_finish_date) {
    const targetDate = new Date(options.target_finish_date);
    if (!isNaN(targetDate.getTime())) {
      baseLateFinishOffset = diffDays(targetDate, projectStartDate);
    }
  }

  for (let i = topologicalOrder.length - 1; i >= 0; i--) {
    const id = topologicalOrder[i];
    const dur = durationDaysMap.get(id)!;
    const succs = outEdges.get(id)!;

    if (succs.length === 0) {
      // Activity with no successors: late finish is the project finish
      lfDaysMap.set(id, baseLateFinishOffset);
      lsDaysMap.set(id, baseLateFinishOffset - dur);
    } else {
      let minLateFinish = Infinity;

      succs.forEach(({ succId, type, lag }) => {
        const succLS = lsDaysMap.get(succId)!;
        const succLF = lfDaysMap.get(succId)!;

        let candidateLF = Infinity;
        if (type === 'FS') {
          candidateLF = succLS - lag;
        } else if (type === 'SS') {
          candidateLF = succLS - lag + dur;
        } else if (type === 'FF') {
          candidateLF = succLF - lag;
        } else if (type === 'SF') {
          candidateLF = succLF - lag + dur;
        }

        if (candidateLF < minLateFinish) {
          minLateFinish = candidateLF;
        }
      });

      lfDaysMap.set(id, minLateFinish);
      lsDaysMap.set(id, minLateFinish - dur);
    }
  }

  // 6. Float & Critical Path Identification
  const criticalPathIds: string[] = [];
  const calculatedActivities: CalculatedActivity[] = [];

  activities.forEach((act) => {
    const id = act.id;
    const durDays = durationDaysMap.get(id)!;
    const es = esDaysMap.get(id) || 0;
    const ef = efDaysMap.get(id) || 0;
    const ls = lsDaysMap.get(id) || 0;
    const lf = lfDaysMap.get(id) || 0;

    const totalFloat = ls - es;
    const totalFloatHours = Math.round(totalFloat * hoursPerDay * 100) / 100;

    // Free float: min(succES - lag) - ef
    let minSuccStartOffset = Infinity;
    outEdges.get(id)?.forEach(({ succId, lag }) => {
      const succES = esDaysMap.get(succId) || 0;
      if (succES - lag < minSuccStartOffset) {
        minSuccStartOffset = succES - lag;
      }
    });

    const freeFloat = minSuccStartOffset !== Infinity ? minSuccStartOffset - ef : totalFloat;
    const isCritical = totalFloat <= floatThreshold;

    if (isCritical) {
      criticalPathIds.push(id);
    }

    if (totalFloat < 0) {
      warnings.push({
        code: 'NEGATIVE_FLOAT',
        activity_id: id,
        message: `Activity ${act.activity_number || id} has negative float of ${Math.round(totalFloat * 10) / 10} days.`,
      });
    }

    const esDate = offsetToDate(es);
    const efDate = offsetToDate(ef);
    const lsDate = offsetToDate(ls);
    const lfDate = offsetToDate(lf);

    calculatedActivities.push({
      id,
      activity_number: act.activity_number,
      description: act.description,
      wbs_code: act.wbs_code,
      duration_hours: Number(act.duration_hours) || durDays * hoursPerDay,
      duration_days: Math.round(durDays * 100) / 100,
      early_start: esDate.toISOString(),
      early_finish: efDate.toISOString(),
      late_start: lsDate.toISOString(),
      late_finish: lfDate.toISOString(),
      total_float_days: Math.round(totalFloat * 100) / 100,
      total_float_hours: totalFloatHours,
      free_float_days: Math.round(freeFloat * 100) / 100,
      is_critical: isCritical,
      predecessors: (inEdges.get(id) || []).map((e) => ({
        activity_id: e.predId,
        type: e.type,
        lag_days: e.lag,
      })),
      successors: (outEdges.get(id) || []).map((e) => ({
        activity_id: e.succId,
        type: e.type,
        lag_days: e.lag,
      })),
      actual_start: act.actual_start ? new Date(act.actual_start).toISOString() : undefined,
      actual_end: act.actual_end ? new Date(act.actual_end).toISOString() : undefined,
      progress: act.progress,
      planned_start: act.planned_start ? new Date(act.planned_start).toISOString() : undefined,
      planned_end: act.planned_end ? new Date(act.planned_end).toISOString() : undefined,
    });
  });

  const projectFinishDate = offsetToDate(maxProjectFinishOffset);

  return {
    success: true,
    project_start: projectStartDate.toISOString().slice(0, 10),
    project_finish: projectFinishDate.toISOString().slice(0, 10),
    total_duration_days: Math.round(maxProjectFinishOffset * 100) / 100,
    total_duration_hours: Math.round(maxProjectFinishOffset * hoursPerDay * 100) / 100,
    critical_path_ids: criticalPathIds,
    activities: calculatedActivities,
    warnings,
  };
}

/**
 * Predecessor string parser (e.g. "ACT-01FS+2d, ACT-02SS")
 */
export function parsePredecessorString(raw: string): { code: string; type: RelationshipType; lag: number }[] {
  if (!raw || !raw.trim()) return [];

  const tokens = raw.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  const results: { code: string; type: RelationshipType; lag: number }[] = [];

  tokens.forEach((token) => {
    let rem = token;
    let lag = 0;

    // Extract optional lag at the end: (+/-Nd or +/-Nh)
    const lagMatch = rem.match(/([+-]\d+)(?:d|h)?$/i);
    if (lagMatch) {
      lag = parseInt(lagMatch[1], 10);
      rem = rem.slice(0, -lagMatch[0].length).trim();
    }

    // Extract optional relationship type at the end: (FS|SS|FF|SF)
    let type: RelationshipType = 'FS';
    const typeMatch = rem.match(/(FS|SS|FF|SF)$/i);
    if (typeMatch) {
      type = typeMatch[1].toUpperCase() as RelationshipType;
      rem = rem.slice(0, -typeMatch[0].length).trim();
    }

    const code = rem.trim();
    if (code) {
      results.push({ code, type, lag });
    }
  });

  return results;
}
