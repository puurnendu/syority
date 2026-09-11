/**
 * M8.8 — Critical Path Intelligence Service
 *
 * Provides deterministic intelligence about the critical path
 * using ACTUAL CPM values from the schedule engine / database.
 *
 * All data comes from Activity model fields:
 *   is_critical, total_float, free_float,
 *   early_start, early_finish, late_start, late_finish,
 *   planned_start, planned_end, actual_start, actual_end,
 *   progress_percent, status
 *
 * Plus ActivityRelationship for predecessor/successor analysis.
 *
 * Does NOT invent mathematical values — only uses existing data.
 */
import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────

export interface CriticalActivity {
  activity_id: string;
  activity_number: string | null;
  description: string;
  status: string | null;
  progress_percent: number;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  early_start: string | null;
  early_finish: string | null;
  late_start: string | null;
  late_finish: string | null;
  total_float_hours: number | null;
  free_float: number | null;
  duration_hours: number;
  predecessor_count: number;
  successor_count: number;
  downstream_impact: number; // count of transitively dependent activities
}

export interface NearCriticalActivity extends CriticalActivity {
  float_margin_hours: number; // how close to critical
}

export interface FloatDistribution {
  zero_float: number;        // is_critical
  low_float: number;         // 0 < float ≤ 8h (1 day)
  moderate_float: number;    // 8h < float ≤ 40h (5 days)
  high_float: number;        // float > 40h
  no_data: number;           // null float
}

export interface CriticalPathIntelligence {
  event_id: string;
  computed_at: string;

  // Critical path summary
  total_activities: number;
  critical_count: number;
  near_critical_count: number;
  critical_percent: number;

  // Critical path duration & dates
  critical_path_start: string | null;
  critical_path_finish: string | null;
  critical_path_duration_hours: number;

  // Float distribution
  float_distribution: FloatDistribution;
  avg_total_float_hours: number | null;
  min_total_float_hours: number | null;
  max_total_float_hours: number | null;

  // Risk indicators
  activities_becoming_critical: number; // near-critical with eroding float
  high_downstream_impact: CriticalActivity[]; // critical activities with most successors
  predecessor_concentration: CriticalActivity[]; // critical activities with most predecessors

  // Full lists
  critical_activities: CriticalActivity[];
  near_critical_activities: NearCriticalActivity[];
}

// ── Constants ──────────────────────────────────────────────────────────

/** Near-critical threshold: activities with total float ≤ THRESHOLD hours */
const NEAR_CRITICAL_THRESHOLD_HOURS = 16; // 2 working days at 8h/day

/** Top-N for impact ranking */
const TOP_N = 10;

// ── Helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

// ── Service ────────────────────────────────────────────────────────────

export class CriticalPathIntelligenceService {

  /**
   * Compute critical path intelligence for an event.
   * All calculations are deterministic and read-only.
   */
  static async analyze(
    eventId: string,
    organizationId: string
  ): Promise<CriticalPathIntelligence> {

    // 1. Fetch all activities with CPM fields
    const activities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        activity_number: true,
        description: true,
        status: true,
        progress_percent: true,
        planned_start: true,
        planned_end: true,
        actual_start: true,
        actual_end: true,
        early_start: true,
        early_finish: true,
        late_start: true,
        late_finish: true,
        total_float: true,
        free_float: true,
        is_critical: true,
        duration_hours: true,
      },
    });

    // 2. Fetch relationships for this event only (predecessor and successor in-event).
    const relationships = await prisma.activityRelationship.findMany({
      where: {
        organization_id: organizationId,
        predecessor: { event_id: eventId, organization_id: organizationId },
        successor: { event_id: eventId, organization_id: organizationId },
      },
      select: {
        predecessor_id: true,
        successor_id: true,
      },
    });

    // Build predecessor/successor maps
    const predCount = new Map<string, number>();
    const succCount = new Map<string, number>();
    const successorGraph = new Map<string, Set<string>>();

    for (const rel of relationships) {
      predCount.set(rel.successor_id, (predCount.get(rel.successor_id) || 0) + 1);
      succCount.set(rel.predecessor_id, (succCount.get(rel.predecessor_id) || 0) + 1);
      if (!successorGraph.has(rel.predecessor_id)) {
        successorGraph.set(rel.predecessor_id, new Set());
      }
      successorGraph.get(rel.predecessor_id)!.add(rel.successor_id);
    }

    // 3. Compute downstream impact (transitive successor count) for each activity
    const activityIds = new Set(activities.map(a => a.id));
    const downstreamCache = new Map<string, number>();

    function computeDownstream(actId: string, visited: Set<string>): number {
      if (downstreamCache.has(actId)) return downstreamCache.get(actId)!;
      if (visited.has(actId)) return 0; // cycle protection
      visited.add(actId);

      const succs = successorGraph.get(actId);
      if (!succs || succs.size === 0) {
        downstreamCache.set(actId, 0);
        return 0;
      }

      let count = 0;
      for (const s of succs) {
        if (activityIds.has(s)) {
          count += 1 + computeDownstream(s, visited);
        }
      }
      downstreamCache.set(actId, count);
      return count;
    }

    // 4. Classify activities
    const critical: CriticalActivity[] = [];
    const nearCritical: NearCriticalActivity[] = [];
    const floatDist: FloatDistribution = {
      zero_float: 0,
      low_float: 0,
      moderate_float: 0,
      high_float: 0,
      no_data: 0,
    };

    let totalFloat = 0;
    let floatCount = 0;
    let minFloat = Infinity;
    let maxFloat = -Infinity;

    let cpStart: Date | null = null;
    let cpFinish: Date | null = null;
    let cpDuration = 0;

    for (const act of activities) {
      const floatHours = act.total_float !== null ? Number(act.total_float) : null;
      const downstream = computeDownstream(act.id, new Set());
      const durHours = act.duration_hours ? Number(act.duration_hours) : 0;

      const base: CriticalActivity = {
        activity_id: act.id,
        activity_number: act.activity_number,
        description: act.description,
        status: act.status ?? null,
        progress_percent: act.progress_percent ?? 0,
        planned_start: toDateStr(act.planned_start),
        planned_end: toDateStr(act.planned_end),
        actual_start: toDateStr(act.actual_start),
        actual_end: toDateStr(act.actual_end),
        early_start: toDateStr(act.early_start),
        early_finish: toDateStr(act.early_finish),
        late_start: toDateStr(act.late_start),
        late_finish: toDateStr(act.late_finish),
        total_float_hours: floatHours,
        free_float: act.free_float ?? null,
        duration_hours: durHours,
        predecessor_count: predCount.get(act.id) || 0,
        successor_count: succCount.get(act.id) || 0,
        downstream_impact: downstream,
      };

      // Float distribution
      if (floatHours === null) {
        floatDist.no_data++;
      } else if (floatHours <= 0) {
        floatDist.zero_float++;
      } else if (floatHours <= 8) {
        floatDist.low_float++;
      } else if (floatHours <= 40) {
        floatDist.moderate_float++;
      } else {
        floatDist.high_float++;
      }

      // Float stats
      if (floatHours !== null) {
        totalFloat += floatHours;
        floatCount++;
        if (floatHours < minFloat) minFloat = floatHours;
        if (floatHours > maxFloat) maxFloat = floatHours;
      }

      // Critical classification
      if (act.is_critical) {
        critical.push(base);
        cpDuration += durHours;

        // Track critical path extent
        const es = act.early_start ? new Date(act.early_start) : (act.planned_start ? new Date(act.planned_start) : null);
        const ef = act.early_finish ? new Date(act.early_finish) : (act.planned_end ? new Date(act.planned_end) : null);

        if (es && (!cpStart || es < cpStart)) cpStart = es;
        if (ef && (!cpFinish || ef > cpFinish)) cpFinish = ef;
      } else if (floatHours !== null && floatHours > 0 && floatHours <= NEAR_CRITICAL_THRESHOLD_HOURS) {
        nearCritical.push({
          ...base,
          float_margin_hours: floatHours,
        });
      }
    }

    // 5. Sort deterministically
    critical.sort((a, b) => {
      // By planned_start ascending, then activity_number
      const da = a.planned_start || '';
      const db = b.planned_start || '';
      if (da !== db) return da < db ? -1 : 1;
      return (a.activity_number || '').localeCompare(b.activity_number || '');
    });

    nearCritical.sort((a, b) => a.float_margin_hours - b.float_margin_hours);

    // 6. High-impact analysis
    const highImpact = [...critical]
      .sort((a, b) => b.downstream_impact - a.downstream_impact)
      .slice(0, TOP_N);

    const predConcentration = [...critical]
      .sort((a, b) => b.predecessor_count - a.predecessor_count)
      .slice(0, TOP_N);

    return {
      event_id: eventId,
      computed_at: new Date().toISOString(),
      total_activities: activities.length,
      critical_count: critical.length,
      near_critical_count: nearCritical.length,
      critical_percent: activities.length > 0
        ? Math.round((critical.length / activities.length) * 1000) / 10
        : 0,
      critical_path_start: toDateStr(cpStart),
      critical_path_finish: toDateStr(cpFinish),
      critical_path_duration_hours: Math.round(cpDuration * 100) / 100,
      float_distribution: floatDist,
      avg_total_float_hours: floatCount > 0
        ? Math.round((totalFloat / floatCount) * 100) / 100
        : null,
      min_total_float_hours: minFloat === Infinity ? null : minFloat,
      max_total_float_hours: maxFloat === -Infinity ? null : maxFloat,
      activities_becoming_critical: nearCritical.filter(a => a.float_margin_hours <= 4).length,
      high_downstream_impact: highImpact,
      predecessor_concentration: predConcentration,
      critical_activities: critical,
      near_critical_activities: nearCritical,
    };
  }
}
