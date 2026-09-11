/**
 * M8.8 — Schedule Baseline Service
 *
 * Event-scoped baseline management: create snapshot, list, assign,
 * delete, and retrieve baseline comparison data.
 *
 * Pattern mirrors: ScopeChangeRequest lifecycle + WorkpackVersion snapshot
 * Extends existing ScheduleBaseline/BaselineActivity models for Event-scope.
 *
 * Authoritative rules:
 *  - Snapshots are immutable after creation
 *  - Only one baseline may be `is_current` per event
 *  - All operations enforce organization_id tenant boundary
 *  - Delete cascades to BaselineActivity rows
 */
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// ── Types ──────────────────────────────────────────────────────────────

export interface BaselineSnapshotMetadata {
  activity_count: number;
  project_start: string | null;
  project_finish: string | null;
  critical_path_count: number;
  snapshot_date: string;
}

export interface BaselineSummary {
  id: string;
  name: string;
  description: string | null;
  is_current: boolean;
  created_at: Date;
  created_by: string;
  snapshot_metadata: BaselineSnapshotMetadata | null;
  activity_count: number;
}

export interface BaselineActivitySnapshot {
  id: string;
  activity_id: string;
  planned_start: Date;
  planned_finish: Date;
  duration: number;
  budgeted_cost: number | null;
  early_start: Date | null;
  early_finish: Date | null;
  late_start: Date | null;
  late_finish: Date | null;
  total_float: number | null;
  free_float: number | null;
  is_critical: boolean;
  status: string | null;
  progress_percent: number;
}

// ── Service ────────────────────────────────────────────────────────────

export class ScheduleBaselineService {

  /**
   * Create an Event-scoped baseline snapshot.
   *
   * Captures all activities for the event at the current point in time,
   * including their CPM-computed fields (ES, EF, LS, LF, float, critical).
   *
   * Runs inside a Prisma $transaction for atomicity.
   */
  static async createBaseline(
    eventId: string,
    organizationId: string,
    name: string,
    userId: string,
    description?: string
  ): Promise<{ id: string; activity_count: number }> {

    // 1. Verify event belongs to organization
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId, deleted_at: null },
      select: { id: true, planned_start: true, planned_end: true },
    });
    if (!event) {
      throw new Error('Event not found or access denied');
    }

    // 2. Fetch all activities for this event
    const activities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        planned_start: true,
        planned_end: true,
        duration_hours: true,
        budgeted_cost: true,
        early_start: true,
        early_finish: true,
        late_start: true,
        late_finish: true,
        total_float: true,
        free_float: true,
        is_critical: true,
        status: true,
        progress_percent: true,
      },
    });

    if (activities.length === 0) {
      throw new Error('Cannot create baseline: event has no activities');
    }

    const baselineId = uuidv4();
    const criticalCount = activities.filter(a => a.is_critical).length;

    const metadata: BaselineSnapshotMetadata = {
      activity_count: activities.length,
      project_start: event.planned_start?.toISOString().slice(0, 10) ?? null,
      project_finish: event.planned_end?.toISOString().slice(0, 10) ?? null,
      critical_path_count: criticalCount,
      snapshot_date: new Date().toISOString(),
    };

    // 3. Create baseline + snapshot in a single transaction
    await prisma.$transaction(async (tx) => {
      // Create the baseline record
      await tx.scheduleBaseline.create({
        data: {
          id: baselineId,
          organization_id: organizationId,
          event_id: eventId,
          name,
          description: description ?? null,
          snapshot_metadata: metadata as any,
          created_by: userId,
          is_current: false,
        },
      });

      // Snapshot all activity fields using createMany for performance
      await tx.baselineActivity.createMany({
        data: activities.map(act => ({
          id: uuidv4(),
          organization_id: organizationId,
          baseline_id: baselineId,
          activity_id: act.id,
          planned_start: act.planned_start ?? new Date(),
          planned_finish: act.planned_end ?? new Date(),
          duration: act.duration_hours ? Number(act.duration_hours) : 0,
          budgeted_cost: act.budgeted_cost ?? null,
          early_start: act.early_start ?? null,
          early_finish: act.early_finish ?? null,
          late_start: act.late_start ?? null,
          late_finish: act.late_finish ?? null,
          total_float: act.total_float ?? null,
          free_float: act.free_float ?? null,
          is_critical: act.is_critical ?? false,
          status: act.status ?? null,
          progress_percent: act.progress_percent ?? 0,
        })),
      });
    }, {
      timeout: 60000, // 1 minute for large events
    });

    return { id: baselineId, activity_count: activities.length };
  }

  /**
   * List all baselines for an event, ordered by creation date (newest first).
   */
  static async listBaselines(
    eventId: string,
    organizationId: string
  ): Promise<BaselineSummary[]> {
    const baselines = await prisma.scheduleBaseline.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
      },
      include: {
        _count: { select: { activities: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return baselines.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      is_current: b.is_current,
      created_at: b.created_at,
      created_by: b.created_by,
      snapshot_metadata: b.snapshot_metadata as BaselineSnapshotMetadata | null,
      activity_count: b._count.activities,
    }));
  }

  /**
   * Get a single baseline with its activity snapshots.
   */
  static async getBaseline(
    baselineId: string,
    organizationId: string
  ): Promise<{ baseline: any; activities: BaselineActivitySnapshot[] } | null> {
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: {
        id: baselineId,
        organization_id: organizationId,
      },
      include: {
        activities: true,
      },
    });

    if (!baseline) return null;

    return {
      baseline: {
        id: baseline.id,
        name: baseline.name,
        description: baseline.description,
        event_id: baseline.event_id,
        is_current: baseline.is_current,
        created_at: baseline.created_at,
        created_by: baseline.created_by,
        snapshot_metadata: baseline.snapshot_metadata,
      },
      activities: baseline.activities.map(a => ({
        id: a.id,
        activity_id: a.activity_id,
        planned_start: a.planned_start,
        planned_finish: a.planned_finish,
        duration: a.duration,
        budgeted_cost: a.budgeted_cost,
        early_start: a.early_start,
        early_finish: a.early_finish,
        late_start: a.late_start,
        late_finish: a.late_finish,
        total_float: a.total_float ? Number(a.total_float) : null,
        free_float: a.free_float,
        is_critical: a.is_critical ?? false,
        status: a.status,
        progress_percent: a.progress_percent ?? 0,
      })),
    };
  }

  /**
   * Assign a baseline as the current/active baseline for an event.
   * Unsets any previously active baseline within the same event.
   */
  static async assignBaseline(
    baselineId: string,
    eventId: string,
    organizationId: string
  ): Promise<void> {
    // Verify baseline exists and belongs to this event + org
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: {
        id: baselineId,
        event_id: eventId,
        organization_id: organizationId,
      },
    });

    if (!baseline) {
      throw new Error('Baseline not found or access denied');
    }

    await prisma.$transaction([
      // Unset all current baselines for this event
      prisma.scheduleBaseline.updateMany({
        where: {
          event_id: eventId,
          organization_id: organizationId,
          is_current: true,
        },
        data: { is_current: false },
      }),
      // Set the target baseline as current
      prisma.scheduleBaseline.update({
        where: { id: baselineId },
        data: { is_current: true },
      }),
    ]);
  }

  /**
   * Delete a baseline and its snapshot data.
   * Cannot delete the current (active) baseline.
   */
  static async deleteBaseline(
    baselineId: string,
    organizationId: string
  ): Promise<void> {
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: {
        id: baselineId,
        organization_id: organizationId,
      },
    });

    if (!baseline) {
      throw new Error('Baseline not found or access denied');
    }

    if (baseline.is_current) {
      throw new Error('Cannot delete the active baseline. Assign a different baseline first.');
    }

    // Cascade delete: BaselineActivity rows are deleted via FK cascade
    await prisma.scheduleBaseline.delete({
      where: { id: baselineId },
    });
  }

  /**
   * Get the current (active) baseline for an event.
   * Returns null if no baseline is assigned.
   */
  static async getCurrentBaseline(
    eventId: string,
    organizationId: string
  ): Promise<{ baseline: any; activities: BaselineActivitySnapshot[] } | null> {
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        is_current: true,
      },
    });

    if (!baseline) return null;

    return this.getBaseline(baseline.id, organizationId);
  }
}
