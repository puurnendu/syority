/**
 * M8.8 — Schedule Variance Service
 *
 * Calculates variance between the current schedule and the assigned baseline.
 * Produces per-activity variance data including:
 *  - Start variance (days)
 *  - Finish variance (days)
 *  - Duration variance (hours)
 *  - Float erosion (hours/days)
 *  - Critical path changes
 *
 * All calculations are deterministic — same inputs always produce same outputs.
 */
import { prisma } from '@/lib/prisma';
import { ScheduleBaselineService } from './ScheduleBaselineService';

// ── Types ──────────────────────────────────────────────────────────────

export interface ActivityVariance {
  activity_id: string;
  activity_number: string | null;
  description: string;
  // Current schedule
  current_start: string | null;
  current_finish: string | null;
  current_duration: number;
  current_float: number | null;
  current_is_critical: boolean;
  current_status: string | null;
  current_progress: number;
  // Baseline snapshot
  baseline_start: string | null;
  baseline_finish: string | null;
  baseline_duration: number;
  baseline_float: number | null;
  baseline_is_critical: boolean;
  baseline_status: string | null;
  baseline_progress: number;
  // Variance (positive = delayed/worse, negative = ahead/better)
  start_variance_days: number | null;
  finish_variance_days: number | null;
  duration_variance_hours: number;
  float_erosion: number | null;
  criticality_changed: boolean;
  criticality_direction: 'became_critical' | 'became_non_critical' | 'unchanged';
}

export interface VarianceSummary {
  baseline_id: string;
  baseline_name: string;
  total_activities: number;
  activities_delayed: number;
  activities_ahead: number;
  activities_on_track: number;
  avg_start_variance_days: number;
  avg_finish_variance_days: number;
  avg_float_erosion: number;
  critical_path_additions: number;
  critical_path_removals: number;
  activities: ActivityVariance[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function diffDays(d1: Date | string | null, d2: Date | string | null): number | null {
  if (!d1 || !d2) return null;
  const a = new Date(d1);
  const b = new Date(d2);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round(((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)) * 10) / 10;
}

function toDateStr(d: Date | string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

// ── Service ────────────────────────────────────────────────────────────

export class ScheduleVarianceService {

  /**
   * Calculate variance between the current schedule and the assigned baseline.
   *
   * If no baselineId is provided, uses the current (active) baseline for the event.
   */
  static async calculateVariance(
    eventId: string,
    organizationId: string,
    baselineId?: string
  ): Promise<VarianceSummary | null> {

    // 1. Resolve baseline
    let baselineData;
    if (baselineId) {
      baselineData = await ScheduleBaselineService.getBaseline(baselineId, organizationId);
    } else {
      baselineData = await ScheduleBaselineService.getCurrentBaseline(eventId, organizationId);
    }

    if (!baselineData) {
      return null; // No baseline assigned — no variance to compute
    }

    // 2. Fetch current activities for this event
    const currentActivities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        activity_number: true,
        description: true,
        planned_start: true,
        planned_end: true,
        duration_hours: true,
        total_float: true,
        is_critical: true,
        status: true,
        progress_percent: true,
      },
    });

    // 3. Index baseline activities by activity_id
    const baselineMap = new Map<string, (typeof baselineData.activities)[number]>();
    for (const ba of baselineData.activities) {
      baselineMap.set(ba.activity_id, ba);
    }

    // 4. Calculate per-activity variance
    const variances: ActivityVariance[] = [];
    let totalStartVariance = 0;
    let totalFinishVariance = 0;
    let totalFloatErosion = 0;
    let startVarianceCount = 0;
    let finishVarianceCount = 0;
    let floatErosionCount = 0;
    let delayed = 0;
    let ahead = 0;
    let onTrack = 0;
    let critAdded = 0;
    let critRemoved = 0;

    for (const act of currentActivities) {
      const bl = baselineMap.get(act.id);

      if (!bl) {
        // Activity added after baseline — no variance data
        variances.push({
          activity_id: act.id,
          activity_number: act.activity_number,
          description: act.description,
          current_start: toDateStr(act.planned_start),
          current_finish: toDateStr(act.planned_end),
          current_duration: act.duration_hours ? Number(act.duration_hours) : 0,
          current_float: act.total_float ? Number(act.total_float) : null,
          current_is_critical: act.is_critical ?? false,
          current_status: act.status,
          current_progress: act.progress_percent ?? 0,
          baseline_start: null,
          baseline_finish: null,
          baseline_duration: 0,
          baseline_float: null,
          baseline_is_critical: false,
          baseline_status: null,
          baseline_progress: 0,
          start_variance_days: null,
          finish_variance_days: null,
          duration_variance_hours: 0,
          float_erosion: null,
          criticality_changed: false,
          criticality_direction: 'unchanged',
        });
        continue;
      }

      const startVar = diffDays(act.planned_start, bl.planned_start);
      const finishVar = diffDays(act.planned_end, bl.planned_finish);
      const currentDur = act.duration_hours ? Number(act.duration_hours) : 0;
      const durationVar = currentDur - bl.duration;

      const currentFloat = act.total_float ? Number(act.total_float) : null;
      const baselineFloat = bl.total_float;
      const floatErosion = (currentFloat !== null && baselineFloat !== null)
        ? baselineFloat - currentFloat  // Positive = float lost
        : null;

      const currentCritical = act.is_critical ?? false;
      const baselineCritical = bl.is_critical ?? false;

      let critDir: 'became_critical' | 'became_non_critical' | 'unchanged' = 'unchanged';
      if (!baselineCritical && currentCritical) {
        critDir = 'became_critical';
        critAdded++;
      } else if (baselineCritical && !currentCritical) {
        critDir = 'became_non_critical';
        critRemoved++;
      }

      if (startVar !== null) {
        totalStartVariance += startVar;
        startVarianceCount++;
        if (startVar > 0.5) delayed++;
        else if (startVar < -0.5) ahead++;
        else onTrack++;
      } else {
        onTrack++;
      }

      if (finishVar !== null) {
        totalFinishVariance += finishVar;
        finishVarianceCount++;
      }

      if (floatErosion !== null) {
        totalFloatErosion += floatErosion;
        floatErosionCount++;
      }

      variances.push({
        activity_id: act.id,
        activity_number: act.activity_number,
        description: act.description,
        current_start: toDateStr(act.planned_start),
        current_finish: toDateStr(act.planned_end),
        current_duration: currentDur,
        current_float: currentFloat,
        current_is_critical: currentCritical,
        current_status: act.status,
        current_progress: act.progress_percent ?? 0,
        baseline_start: toDateStr(bl.planned_start),
        baseline_finish: toDateStr(bl.planned_finish),
        baseline_duration: bl.duration,
        baseline_float: baselineFloat,
        baseline_is_critical: baselineCritical,
        baseline_status: bl.status,
        baseline_progress: bl.progress_percent,
        start_variance_days: startVar,
        finish_variance_days: finishVar,
        duration_variance_hours: Math.round(durationVar * 100) / 100,
        float_erosion: floatErosion !== null ? Math.round(floatErosion * 100) / 100 : null,
        criticality_changed: critDir !== 'unchanged',
        criticality_direction: critDir,
      });
    }

    return {
      baseline_id: baselineData.baseline.id,
      baseline_name: baselineData.baseline.name,
      total_activities: variances.length,
      activities_delayed: delayed,
      activities_ahead: ahead,
      activities_on_track: onTrack,
      avg_start_variance_days: startVarianceCount > 0
        ? Math.round((totalStartVariance / startVarianceCount) * 10) / 10
        : 0,
      avg_finish_variance_days: finishVarianceCount > 0
        ? Math.round((totalFinishVariance / finishVarianceCount) * 10) / 10
        : 0,
      avg_float_erosion: floatErosionCount > 0
        ? Math.round((totalFloatErosion / floatErosionCount) * 10) / 10
        : 0,
      critical_path_additions: critAdded,
      critical_path_removals: critRemoved,
      activities: variances,
    };
  }
}
