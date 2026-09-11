/**
 * M8.8 — Schedule Forecast Service
 *
 * Computes forecast finish dates for all activities in an event based on:
 * - Completed activities: forecast = actual_end
 * - In-progress with remaining_duration: forecast = actual_start + remaining_duration
 * - In-progress with progress%: forecast = actual_start + (elapsed / progress%) * 100
 * - Not started: forecast = planned_end
 *
 * All calculations are deterministic and read-only.
 */
import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────

export interface ActivityForecast {
  activity_id: string;
  activity_number: string | null;
  description: string;
  status: string | null;
  progress_percent: number;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  forecast_finish: string | null;
  forecast_method: 'actual' | 'remaining_duration' | 'earned_progress' | 'planned';
  variance_from_plan_days: number | null;
}

export interface ForecastSummary {
  total_activities: number;
  completed: number;
  in_progress: number;
  not_started: number;
  forecasted_late: number;
  forecasted_early: number;
  forecasted_on_time: number;
  project_forecast_finish: string | null;
  project_planned_finish: string | null;
  project_variance_days: number | null;
  activities: ActivityForecast[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date | string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

function addDaysToDate(d: Date, days: number): Date {
  const result = new Date(d);
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}

function diffDays(d1: Date | string | null, d2: Date | string | null): number | null {
  if (!d1 || !d2) return null;
  const a = new Date(d1);
  const b = new Date(d2);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round(((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)) * 10) / 10;
}

// ── Service ────────────────────────────────────────────────────────────

export class ScheduleForecastService {

  /**
   * Compute forecast finish dates for all activities in an event.
   */
  static async computeForecast(
    eventId: string,
    organizationId: string,
    hoursPerDay: number = 8
  ): Promise<ForecastSummary> {

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
        duration_hours: true,
        remaining_duration: true,
      },
    });

    const now = new Date();
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let late = 0;
    let early = 0;
    let onTime = 0;
    let maxForecast: Date | null = null;
    let maxPlanned: Date | null = null;

    const forecasts: ActivityForecast[] = activities.map(act => {
      let forecastFinish: Date | null = null;
      let method: ActivityForecast['forecast_method'] = 'planned';

      const plannedEnd = act.planned_end ? new Date(act.planned_end) : null;
      const actualStart = act.actual_start ? new Date(act.actual_start) : null;
      const actualEnd = act.actual_end ? new Date(act.actual_end) : null;
      const progress = act.progress_percent ?? 0;
      const remainDur = act.remaining_duration;

      if (act.status === 'completed' || actualEnd) {
        // Completed: forecast = actual_end
        forecastFinish = actualEnd ?? plannedEnd;
        method = 'actual';
        completed++;
      } else if (actualStart && remainDur !== null && remainDur !== undefined) {
        // In-progress with remaining_duration
        const remainDays = remainDur / hoursPerDay;
        forecastFinish = addDaysToDate(now, remainDays);
        method = 'remaining_duration';
        inProgress++;
      } else if (actualStart && progress > 0) {
        // In-progress with progress%: earned value extrapolation
        const elapsedMs = now.getTime() - actualStart.getTime();
        const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
        if (elapsedDays > 0 && progress > 0) {
          const totalEstDays = (elapsedDays / progress) * 100;
          forecastFinish = addDaysToDate(actualStart, totalEstDays);
        } else {
          forecastFinish = plannedEnd;
        }
        method = 'earned_progress';
        inProgress++;
      } else {
        // Not started
        forecastFinish = plannedEnd;
        method = 'planned';
        notStarted++;
      }

      // Variance from plan
      const varianceDays = diffDays(forecastFinish, plannedEnd);
      if (varianceDays !== null) {
        if (varianceDays > 0.5) late++;
        else if (varianceDays < -0.5) early++;
        else onTime++;
      }

      // Track max forecast and planned for project-level
      if (forecastFinish && (!maxForecast || forecastFinish > maxForecast)) {
        maxForecast = forecastFinish;
      }
      if (plannedEnd && (!maxPlanned || plannedEnd > maxPlanned)) {
        maxPlanned = plannedEnd;
      }

      return {
        activity_id: act.id,
        activity_number: act.activity_number,
        description: act.description,
        status: act.status,
        progress_percent: progress,
        planned_start: toDateStr(act.planned_start),
        planned_end: toDateStr(act.planned_end),
        actual_start: toDateStr(act.actual_start),
        actual_end: toDateStr(act.actual_end),
        forecast_finish: toDateStr(forecastFinish),
        forecast_method: method,
        variance_from_plan_days: varianceDays,
      };
    });

    return {
      total_activities: activities.length,
      completed,
      in_progress: inProgress,
      not_started: notStarted,
      forecasted_late: late,
      forecasted_early: early,
      forecasted_on_time: onTime,
      project_forecast_finish: toDateStr(maxForecast),
      project_planned_finish: toDateStr(maxPlanned),
      project_variance_days: diffDays(maxForecast, maxPlanned),
      activities: forecasts,
    };
  }
}
