/**
 * M8.10 — EVM Snapshot Service
 *
 * Handles loading EVM data from the database, calculating EVM metrics,
 * persisting snapshots, and retrieving stored curves/summaries.
 *
 * This service bridges the pure calculation engine (EvmCalculationService)
 * with the Prisma persistence layer.
 *
 * Architecture Lock: M8.10_ARCHITECTURE_LOCK.md §6
 * Baseline: ScheduleBaseline with is_current=true
 * AC Source: Activity.actual_cost (UD-3 Decision A)
 * Security: All queries enforce organization_id
 */

import { prisma } from '../../lib/prisma';
import {
  calculateEventEvm,
  generateCurveData,
  toSnapshotSummary,
  calculateActivityEvm,
  type EvmActivityInput,
} from './EvmCalculationService';
import type {
  EvmSummary,
  EvmCurveData,
  EvmSnapshotCurveData,
  EvmSnapshotSummary,
  EvmSnapshotType,
  ActivityEvmResult,
  WbsEvmNode,
} from './types';
import { randomUUID } from 'crypto';

// ─── Data Loading ────────────────────────────────────────────────────────────

interface BaselineActivityRow {
  id: string;
  activity_id: string;
  budgeted_cost: number | null;
  planned_start: Date;
  planned_finish: Date;
  duration: number;
  is_critical: boolean | null;
}

interface ActivityRow {
  id: string;
  description: string;
  workpack_id: string | null;
  duration_hours: number | null;
  work_category: string | null;
  progress_percent: number | null;
  actual_cost: number | null;
  actual_start: Date | null;
  actual_end: Date | null;
  planned_end: Date | null;
  planned_start: Date | null;
}

/**
 * Load all activities for an event, joined with their baseline data,
 * and transform into EvmActivityInput[].
 */
export async function loadEvmActivities(
  eventId: string,
  organizationId: string,
  baselineId: string
): Promise<EvmActivityInput[]> {
  // Load activities
  const activities = await prisma.$queryRawUnsafe<ActivityRow[]>(`
    SELECT id, description, workpack_id, duration_hours, work_category,
           progress_percent, actual_cost, actual_start, actual_end, planned_end, planned_start
    FROM "Activity"
    WHERE event_id = $1 AND organization_id = $2 AND deleted_at IS NULL
    ORDER BY created_at
  `, eventId, organizationId);

  // Load baseline activities
  const baselineActivities = await prisma.$queryRawUnsafe<BaselineActivityRow[]>(`
    SELECT id, activity_id, budgeted_cost, planned_start, planned_finish, duration, is_critical
    FROM "BaselineActivity"
    WHERE baseline_id = $1 AND organization_id = $2
  `, baselineId, organizationId);

  // Index baseline activities by activity_id
  const baselineMap = new Map<string, BaselineActivityRow>();
  for (const ba of baselineActivities) {
    baselineMap.set(ba.activity_id, ba);
  }

  // Transform to EvmActivityInput[]
  return activities.map((a): EvmActivityInput => {
    const baseline = baselineMap.get(a.id);
    return {
      activityId: a.id,
      description: a.description,
      workpackId: a.workpack_id,
      durationHours: a.duration_hours !== null ? Number(a.duration_hours) : null,
      workCategory: a.work_category,
      progressPercent: a.progress_percent,
      actualCost: a.actual_cost,
      actualStart: a.actual_start,
      actualEnd: a.actual_end,
      plannedEnd: a.planned_end,
      baselineBudgetedCost: baseline?.budgeted_cost ?? null,
      baselinePlannedStart: baseline?.planned_start ?? null,
      baselinePlannedFinish: baseline?.planned_finish ?? null,
    };
  });
}

/**
 * Get the current active baseline for an event.
 */
export async function getCurrentBaseline(
  eventId: string,
  organizationId: string
): Promise<{ id: string; name: string } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(`
    SELECT id, name FROM "ScheduleBaseline"
    WHERE event_id = $1 AND organization_id = $2 AND is_current = true
    LIMIT 1
  `, eventId, organizationId);

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get event date boundaries.
 */
export async function getEventDates(
  eventId: string,
  organizationId: string
): Promise<{ planned_start: Date | null; planned_end: Date | null } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ planned_start: Date | null; planned_end: Date | null }>>(`
    SELECT planned_start, planned_end FROM "events"
    WHERE id = $1 AND organization_id = $2
    LIMIT 1
  `, eventId, organizationId);

  return rows.length > 0 ? rows[0] : null;
}

// ─── EVM Calculation Orchestration ───────────────────────────────────────────

/**
 * Calculate live EVM summary for an event.
 */
export async function calculateLiveEvm(
  eventId: string,
  organizationId: string,
  dataDate?: Date
): Promise<EvmSummary | null> {
  const baseline = await getCurrentBaseline(eventId, organizationId);
  if (!baseline) return null;

  const activities = await loadEvmActivities(eventId, organizationId, baseline.id);
  if (activities.length === 0) return null;

  const dd = dataDate ?? new Date();
  return calculateEventEvm(activities, eventId, baseline.id, dd);
}

/**
 * Calculate activity-level EVM detail for drill-down.
 */
export async function calculateActivityDrillDown(
  eventId: string,
  organizationId: string,
  dataDate?: Date
): Promise<ActivityEvmResult[]> {
  const baseline = await getCurrentBaseline(eventId, organizationId);
  if (!baseline) return [];

  const activities = await loadEvmActivities(eventId, organizationId, baseline.id);
  const dd = dataDate ?? new Date();

  return activities.map(a => calculateActivityEvm(a, dd));
}

/**
 * Generate S-curve data for an event.
 */
export async function generateEventCurve(
  eventId: string,
  organizationId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<EvmCurveData | null> {
  const baseline = await getCurrentBaseline(eventId, organizationId);
  if (!baseline) return null;

  const activities = await loadEvmActivities(eventId, organizationId, baseline.id);
  if (activities.length === 0) return null;

  const eventDates = await getEventDates(eventId, organizationId);
  const start = fromDate ?? eventDates?.planned_start ?? new Date();
  const end = toDate ?? eventDates?.planned_end ?? new Date();

  const curveData = generateCurveData(activities, start, end);

  // Calculate EAC projection from today forward
  const today = new Date();
  const summary = calculateEventEvm(activities, eventId, baseline.id, today);
  const eacProjection: (number | null)[] = curveData.dates.map((dateStr) => {
    const d = new Date(dateStr);
    return d >= today && summary?.eac !== null ? summary!.eac : null;
  });

  return {
    dates: curveData.dates,
    pv: curveData.pv,
    ev: curveData.ev,
    ac: curveData.ac,
    eacProjection,
  };
}

// ─── Snapshot Persistence ────────────────────────────────────────────────────

/**
 * Create and persist an EVM snapshot.
 */
export async function createSnapshot(
  eventId: string,
  organizationId: string,
  snapshotType: EvmSnapshotType
): Promise<{ id: string; summary: EvmSnapshotSummary }> {
  const baseline = await getCurrentBaseline(eventId, organizationId);
  if (!baseline) throw new Error(`No active baseline found for event ${eventId}`);

  const activities = await loadEvmActivities(eventId, organizationId, baseline.id);
  const dataDate = new Date();

  // Calculate summary
  const evmSummary = calculateEventEvm(activities, eventId, baseline.id, dataDate);
  const snapshotSummary = toSnapshotSummary(evmSummary);

  // Calculate curve
  const eventDates = await getEventDates(eventId, organizationId);
  const start = eventDates?.planned_start ?? dataDate;
  const end = eventDates?.planned_end ?? dataDate;
  const curveData = generateCurveData(activities, start, end);

  // Persist
  const id = randomUUID();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "EvmSnapshot" (id, organization_id, event_id, snapshot_date, snapshot_type, curve_data, summary, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `, id, organizationId, eventId, dataDate, snapshotType,
    JSON.stringify(curveData), JSON.stringify(snapshotSummary)
  );

  return { id, summary: snapshotSummary };
}

/**
 * Get the latest snapshot for an event.
 */
export async function getLatestSnapshot(
  eventId: string,
  organizationId: string
): Promise<{ id: string; snapshot_date: Date; summary: EvmSnapshotSummary; curve_data: EvmSnapshotCurveData } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    snapshot_date: Date;
    summary: EvmSnapshotSummary;
    curve_data: EvmSnapshotCurveData;
  }>>(`
    SELECT id, snapshot_date, summary, curve_data
    FROM "EvmSnapshot"
    WHERE event_id = $1 AND organization_id = $2
    ORDER BY snapshot_date DESC
    LIMIT 1
  `, eventId, organizationId);

  return rows.length > 0 ? rows[0] : null;
}

// ─── WBS Drill-Down ──────────────────────────────────────────────────────────

/**
 * Build a WBS drill-down tree for EVM metrics.
 * Groups activities by workpack and calculates aggregate EVM per workpack.
 */
export async function buildWbsDrillDown(
  eventId: string,
  organizationId: string,
  dataDate?: Date
): Promise<WbsEvmNode | null> {
  const baseline = await getCurrentBaseline(eventId, organizationId);
  if (!baseline) return null;

  const activities = await loadEvmActivities(eventId, organizationId, baseline.id);
  const dd = dataDate ?? new Date();

  // Get workpack names
  const workpacks = await prisma.$queryRawUnsafe<Array<{ id: string; title: string }>>(`
    SELECT id, title FROM "Workpack"
    WHERE event_id = $1 AND organization_id = $2
  `, eventId, organizationId);

  const wpMap = new Map(workpacks.map(wp => [wp.id, wp.title]));

  // Group activities by workpack
  const grouped = new Map<string, EvmActivityInput[]>();
  for (const a of activities) {
    const key = a.workpackId ?? 'unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  // Build workpack nodes
  const wpNodes: WbsEvmNode[] = [];
  for (const [wpId, wpActivities] of grouped) {
    const wpEvm = calculateEventEvm(wpActivities, eventId, baseline.id, dd);
    const activityNodes: WbsEvmNode[] = wpActivities.map(a => {
      const r = calculateActivityEvm(a, dd);
      return {
        id: a.activityId,
        name: a.description,
        level: 'activity' as const,
        bac: r.bac,
        pv: r.pv,
        ev: r.ev,
        ac: r.ac,
        cv: r.cv,
        sv: r.sv,
        cpi: r.cpi,
        spi: r.spi,
      };
    });

    wpNodes.push({
      id: wpId,
      name: wpMap.get(wpId) ?? 'Unassigned',
      level: 'workpack',
      bac: wpEvm.bac,
      pv: wpEvm.pv,
      ev: wpEvm.ev,
      ac: wpEvm.ac,
      cv: wpEvm.cv,
      sv: wpEvm.sv,
      cpi: wpEvm.cpi,
      spi: wpEvm.spi,
      children: activityNodes,
    });
  }

  // Event-level root node
  const eventEvm = calculateEventEvm(activities, eventId, baseline.id, dd);
  return {
    id: eventId,
    name: 'Event Total',
    level: 'event',
    bac: eventEvm.bac,
    pv: eventEvm.pv,
    ev: eventEvm.ev,
    ac: eventEvm.ac,
    cv: eventEvm.cv,
    sv: eventEvm.sv,
    cpi: eventEvm.cpi,
    spi: eventEvm.spi,
    children: wpNodes,
  };
}
