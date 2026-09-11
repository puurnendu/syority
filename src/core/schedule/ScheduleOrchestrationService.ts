/**
 * ScheduleOrchestrationService — M11 authoritative CPM orchestration layer.
 *
 * This service is the SOLE entry point for CPM schedule calculation in the STO platform.
 * It replaces the legacy SchedulingService.calculateProjectSchedule() by:
 *
 *   1. Loading activities + relationships scoped to an EVENT (not project)
 *   2. Loading the applicable ScheduleCalendar
 *   3. Delegating to the pure-function `calculateSchedule()` from scheduleEngine.ts
 *   4. Persisting CPM results (ES/EF/LS/LF/TF/FF/is_critical)
 *   5. Returning enriched data for the frontend (Gantt, S-Curve, etc.)
 *
 * Key design decisions:
 *   - Event-scoped (event_id), NOT project-scoped
 *   - Float units: HOURS canonical (persisted), days in API response for UI
 *   - CalendarEngine loaded from Event.calendar_id → ScheduleCalendar
 *   - Stateless: no cached state; every invocation fetches current data
 *
 * Created: M11-R0 (replaces SchedulingService CPM + manual orchestration in /api/schedule/calculate)
 */

import { prisma } from '@/lib/prisma';
import { CalendarEngine } from '@/lib/CalendarEngine';
import {
  calculateSchedule,
  type ScheduleActivityInput,
  type ScheduleRelationshipInput,
  type ScheduleCalculationResult,
} from '@/lib/scheduleEngine';
import { PlannedDateAuthority } from './PlannedDateAuthority';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalculateEventScheduleOptions {
  /** If true, persist CPM results back to the Activity table. Default: true */
  persist?: boolean;
  /** Override the critical-float threshold (in days). Default: 0 */
  critical_float_threshold?: number;
  /** If provided, use this start date instead of the event's planned_start */
  override_start_date?: Date;
}

export interface EventScheduleResult {
  success: boolean;
  count: number;
  error?: string;
  /** Full CPM calculation result from the engine */
  calculation: ScheduleCalculationResult;
  /** Enriched activities from DB (after persistence) — includes relations, resources */
  activities: any[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ScheduleOrchestrationService {
  /**
   * Calculate the CPM schedule for all activities in a shutdown event.
   *
   * This is the ONLY authoritative CPM calculation entry point.
   * All callers (API routes, workers) MUST use this method.
   */
  static async calculateEventSchedule(
    eventId: string,
    orgId: string,
    options: CalculateEventScheduleOptions = {}
  ): Promise<EventScheduleResult> {
    const { persist = true, critical_float_threshold = 0 } = options;

    // 1. Verify Event ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId, deleted_at: null },
      select: {
        id: true,
        name: true,
        planned_start: true,
        planned_end: true,
        calendar_id: true,
      },
    });

    if (!event) {
      return {
        success: false,
        count: 0,
        error: 'Shutdown event not found or access denied',
        calculation: this.emptyResult(),
        activities: [],
      };
    }

    // 2. Load CalendarEngine (event calendar → org default → fallback)
    const calendar = await this.loadCalendar(orgId, event.calendar_id);

    // 3. Fetch Activities scoped to this event
    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        event_id: eventId,
        deleted_at: null,
      },
      select: {
        id: true,
        activity_number: true,
        description: true,
        duration_hours: true,
        planned_start: true,
        planned_end: true,
        wbs_code: true,
        status: true,
        discipline_id: true,
        actual_start: true,
        actual_end: true,
        progress_percent: true,
      },
    });

    if (activities.length === 0) {
      return {
        success: true,
        count: 0,
        calculation: this.emptyResult(),
        activities: [],
      };
    }

    const activityIds = new Set(activities.map((a) => a.id));

    // 4. Fetch Relationships (only those connecting activities within this event)
    const relationships = await prisma.activityRelationship.findMany({
      where: {
        organization_id: orgId,
        predecessor_id: { in: Array.from(activityIds) },
        successor_id: { in: Array.from(activityIds) },
      },
      select: {
        id: true,
        predecessor_id: true,
        successor_id: true,
        relationship_type: true,
        lag_days: true,
        lag_minutes: true,
      },
    });

    // 5. Determine project start date
    const projectStartDate =
      options.override_start_date ??
      (event.planned_start ? new Date(event.planned_start) : new Date());

    // 6. Execute CPM via the authoritative schedule engine
    const result = calculateSchedule(
      activities.map(
        (a): ScheduleActivityInput => ({
          ...a,
          duration_hours: a.duration_hours ? Number(a.duration_hours) : 8,
          actual_start: a.actual_start,
          actual_end: a.actual_end,
          progress: a.progress_percent,
        })
      ),
      relationships.map(
        (r): ScheduleRelationshipInput => ({
          ...r,
          relationship_type: r.relationship_type as any,
        })
      ),
      {
        project_start_date: projectStartDate,
        working_hours_per_day: calendar.getHoursPerDay(),
        critical_float_threshold,
        // Sprint 1a (audit §7.4): the loaded calendar is now actually consumed —
        // derived dates skip weekends/holidays/exceptions instead of advancing
        // in naive 24h steps.
        calendar,
      }
    );

    // 7. Persist CPM results if requested — Sprint 1b: planned_* is now
    //    written from early_* unless a planner override is active.
    if (persist && result.success) {
      await PlannedDateAuthority.persistCpmResults(orgId, result.activities, {
        hoursPerDay: calendar.getHoursPerDay(),
      });
    }

    // 8. Fetch enriched activities for the frontend
    const enrichedActivities = persist
      ? await prisma.activity.findMany({
          where: {
            organization_id: orgId,
            event_id: eventId,
            deleted_at: null,
          },
          include: {
            predecessors: true,
            successors: true,
            resources: true,
          },
          orderBy: { sequence_number: 'asc' },
        })
      : [];

    return {
      success: result.success,
      count: activities.length,
      calculation: result,
      activities: enrichedActivities,
    };
  }

  /**
   * Hours/day from the event calendar (event calendar → org default → fallback).
   * Used by M8.9 scenario calculation so it does not hard-code 10h/day.
   * Does not persist CPM.
   */
  static async resolveWorkingHoursPerDay(
    eventId: string,
    orgId: string
  ): Promise<number> {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId, deleted_at: null },
      select: { calendar_id: true },
    });
    if (!event) {
      throw new Error('Shutdown event not found or access denied');
    }
    const calendar = await this.loadCalendar(orgId, event.calendar_id);
    return calendar.getHoursPerDay();
  }

  // ─── Lookahead ──────────────────────────────────────────────────────────────

  /**
   * Fetch activities within a lookahead window for an event.
   * Migrated from SchedulingService.getLookaheadActivities.
   */
  static async getLookaheadActivities(
    eventId: string,
    orgId: string,
    windowDays: number = 7
  ) {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + windowDays);

    return prisma.activity.findMany({
      where: {
        organization_id: orgId,
        event_id: eventId,
        deleted_at: null,
        AND: [
          {
            OR: [
              { early_start: { gte: now, lte: future } },
              { early_finish: { gte: now, lte: future } },
              { early_start: { lte: now }, early_finish: { gte: future } },
            ],
          },
        ],
      },
      include: {
        workpack: { select: { title: true, workpack_id_code: true } },
        discipline: true,
      },
      orderBy: { early_start: 'asc' },
    });
  }

  // ─── S-Curve ────────────────────────────────────────────────────────────────

  /**
   * Generate S-Curve data for an event.
   * Migrated from SchedulingService.generateSCurveData.
   */
  static async generateSCurveData(eventId: string, orgId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId, deleted_at: null },
      select: { planned_start: true, planned_end: true },
    });

    if (!event?.planned_start || !event?.planned_end) return [];

    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        event_id: eventId,
        deleted_at: null,
      },
      select: {
        duration_hours: true,
        early_finish: true,
        actual_end: true,
        progress_percent: true,
      },
    });

    if (activities.length === 0) return [];

    const startDate = new Date(event.planned_start);
    const endDate = new Date(event.planned_end);
    const totalDuration = activities.reduce(
      (sum, a) => sum + Number(a.duration_hours || 0),
      0
    );

    if (totalDuration === 0) return [];

    const result: { date: string; planned: number; actual: number | null }[] = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dateStr = curr.toISOString().split('T')[0];
      const checkDate = new Date(dateStr + 'T23:59:59');

      const plannedFinishedDuration = activities
        .filter((a) => a.early_finish && a.early_finish <= checkDate)
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
        planned: Math.min(100, Math.round(plannedPercent * 10) / 10),
        actual: curr <= new Date()
          ? Math.min(100, Math.round(actualPercent * 10) / 10)
          : null,
      });

      curr.setDate(curr.getDate() + 1);
      if (result.length > 500) break;
    }

    return result;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Load CalendarEngine: event-specific → org default → hardcoded fallback.
   */
  private static async loadCalendar(
    orgId: string,
    calendarId: string | null | undefined
  ): Promise<CalendarEngine> {
    // 1. Try event-specific calendar
    if (calendarId) {
      const cal = await prisma.scheduleCalendar.findUnique({
        where: { id: calendarId },
      });
      if (cal) {
        const exceptions = Array.isArray(cal.exceptions)
          ? (cal.exceptions as { date: string; type: 'holiday' | 'work' }[])
          : [];
        return new CalendarEngine(cal.work_days, cal.hours_per_day, exceptions);
      }
    }

    // 2. Try org default calendar
    const orgCal = await prisma.scheduleCalendar.findFirst({
      where: { organization_id: orgId, is_default: true },
    });
    if (orgCal) {
      const exceptions = Array.isArray(orgCal.exceptions)
        ? (orgCal.exceptions as { date: string; type: 'holiday' | 'work' }[])
        : [];
      return new CalendarEngine(orgCal.work_days, orgCal.hours_per_day, exceptions);
    }

    // 3. Fallback: Mon–Sat, 10h/day
    return new CalendarEngine();
  }

  /** Empty CPM result for edge cases (no activities, event not found). */
  private static emptyResult(): ScheduleCalculationResult {
    const today = new Date().toISOString().slice(0, 10);
    return {
      success: true,
      project_start: today,
      project_finish: today,
      total_duration_days: 0,
      total_duration_hours: 0,
      critical_path_ids: [],
      activities: [],
      warnings: [],
    };
  }
}
