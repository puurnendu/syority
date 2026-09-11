/**
 * M8.15 — Equipment 360 V1 Aggregation Endpoint
 *
 * GET /api/assets/[assetId]/360
 *
 * READ-ONLY endpoint that aggregates:
 *   Equipment → Scope → Workpack → Activity → Schedule → Execution → M8.13 Progress
 *
 * PROGRESS AUTHORITY:
 *   All progress values come from M8.13 ProgressAggregationService.
 *   This endpoint contains ZERO progress calculation logic.
 *   Only status COUNTS are derived locally.
 *
 * SECURITY:
 *   guardApi('workpacks.view') + orgScope → tenant-isolated queries
 *
 * EVENT CONTEXT:
 *   Data is grouped by event. Never merged across events.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { assetId } = await ctx.params;

  try {
    // ── 1. Equipment (tenant-verified) ─────────────────────────────────────
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: {
        id: true,
        tag_number: true,
        name: true,
        asset_type: true,
        description: true,
        service_description: true,
        is_active: true,
        updated_by: true,
        updated_at: true,
        created_at: true,
        manufacturer: true,
        model_number: true,
        design_pressure_barg: true,
        design_temp_c: true,
        operating_pressure_barg: true,
        operating_temp_c: true,
        Site: { select: { id: true, name: true } },
        plant: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, code: true } },
        system: { select: { id: true, name: true, code: true } },
      },
    });
    if (!asset) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    // ── 2. Scope Items for this asset (tenant-isolated) ────────────────────
    const scopeItems = await prisma.scopeItem.findMany({
      where: {
        asset_id: assetId,
        organization_id: orgId,
        deleted_at: null,
      },
      select: {
        id: true,
        reason: true,
        discipline: true,
        priority: true,
        complexity: true,
        is_deferred: true,
        is_additional: true,
        template_name: true,
        estimated_hours: true,
        planner_notes: true,
        created_at: true,
        updated_at: true,
        scope: {
          select: {
            id: true,
            name: true,
            status: true,
            event_id: true,
            event: { select: { id: true, name: true, status: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // ── 3. Workpacks for this asset (tenant-isolated) ──────────────────────
    const workpacks = await prisma.workpack.findMany({
      where: {
        asset_id: assetId,
        organization_id: orgId,
        deleted_at: null,
      },
      select: {
        id: true,
        workpack_id_code: true,
        title: true,
        status: true,
        priority: true,
        equipment_type: true,
        planned_start_date: true,
        planned_end_date: true,
        overall_progress: true,
        readiness_score: true,
        event_id: true,
        scope_item_id: true,
        discipline: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, status: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    // ── 4. Activities through workpacks (tenant-isolated via workpack) ──────
    const workpackIds = workpacks.map((wp) => wp.id);

    const activities = workpackIds.length > 0
      ? await prisma.activity.findMany({
          where: {
            workpack_id: { in: workpackIds },
            organization_id: orgId,
            deleted_at: null,
          },
          select: {
            id: true,
            activity_number: true,
            description: true,
            status: true,
            planned_start: true,
            planned_end: true,
            actual_start: true,
            actual_end: true,
            progress_percent: true,
            duration_hours: true,
            is_critical: true,
            total_float: true,
            early_start: true,
            early_finish: true,
            late_start: true,
            late_finish: true,
            responsible: true,
            workpack_id: true,
            event_id: true,
            standard_activity_type_id: true,
            standard_activity_type: { select: { id: true, name: true, code: true } },
            discipline: { select: { id: true, name: true } },
            workpack: { select: { workpack_id_code: true, title: true } },
          },
          orderBy: [{ workpack_id: 'asc' }, { sequence_number: 'asc' }],
        })
      : [];

    // ── 5. Execution: Recent progress logs (tenant-isolated via activity) ──
    const activityIds = activities.map((a) => a.id);

    const recentLogs = activityIds.length > 0
      ? await prisma.progressLog.findMany({
          where: {
            activity_id: { in: activityIds },
          },
          select: {
            id: true,
            activity_id: true,
            log_date: true,
            progress_percent: true,
            remarks: true,
            recorded_at: true,
            logged_by: true,
          },
          orderBy: { recorded_at: 'desc' },
          take: 50,
        })
      : [];

    // ── 6. M8.13 Progress — delegated to authoritative service ─────────────
    // Get workpack-level progress from M8.13 (per-workpack pattern)
    const workpackProgressMap = new Map<string, any>();
    for (const wp of workpacks) {
      try {
        const metrics = await ProgressAggregationService.getWorkpackProgress(orgId, wp.id);
        workpackProgressMap.set(wp.id, metrics);
      } catch {
        // Graceful fallback — workpack may have no activities
        workpackProgressMap.set(wp.id, null);
      }
    }

    // ── 7. Group by event ──────────────────────────────────────────────────
    // Collect distinct event IDs from workpacks and scope items
    const eventIds = new Set<string>();
    for (const wp of workpacks) {
      if (wp.event_id) eventIds.add(wp.event_id);
    }
    for (const si of scopeItems) {
      if (si.scope?.event_id) eventIds.add(si.scope.event_id);
    }

    // Get identical activity intelligence per event (M8.13 delegation)
    const identicalByEvent = new Map<string, any[]>();
    for (const eventId of eventIds) {
      try {
        const identical = await ProgressAggregationService.getIdenticalActivityProgress(
          orgId,
          eventId,
          asset.asset_type || undefined
        );
        identicalByEvent.set(eventId, identical);
      } catch {
        identicalByEvent.set(eventId, []);
      }
    }

    // Build event-grouped response
    const events = Array.from(eventIds).map((eventId) => {
      // Scope items for this event
      const eventScopeItems = scopeItems.filter((si) => si.scope?.event_id === eventId);

      // Workpacks for this event
      const eventWorkpacks = workpacks
        .filter((wp) => wp.event_id === eventId)
        .map((wp) => ({
          ...wp,
          progress: workpackProgressMap.get(wp.id) ?? null,
        }));

      // Activities for this event's workpacks
      const eventWorkpackIds = new Set(eventWorkpacks.map((wp) => wp.id));
      const eventActivities = activities.filter((a) => a.workpack_id && eventWorkpackIds.has(a.workpack_id));

      // Schedule summary (COUNTS ONLY — no recalculation)
      const schedule = {
        totalActivities: eventActivities.length,
        criticalActivities: eventActivities.filter((a) => a.is_critical).length,
        activitiesWithNegativeFloat: eventActivities.filter(
          (a) => a.total_float !== null && Number(a.total_float) < 0
        ).length,
        earliestPlannedStart: eventActivities
          .map((a) => a.planned_start)
          .filter(Boolean)
          .sort()[0] ?? null,
        latestPlannedEnd: eventActivities
          .map((a) => a.planned_end)
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? null,
      };

      // Execution: logs for this event's activities
      const eventActivityIds = new Set(eventActivities.map((a) => a.id));
      const eventLogs = recentLogs.filter((log) => eventActivityIds.has(log.activity_id));

      // Event metadata (from first workpack or scope that has it)
      const eventMeta = eventWorkpacks[0]?.event ?? eventScopeItems[0]?.scope?.event ?? { id: eventId, name: eventId, status: null };

      return {
        event: eventMeta,
        scope: {
          items: eventScopeItems.map((si) => ({
            id: si.id,
            reason: si.reason,
            discipline: si.discipline,
            priority: si.priority,
            complexity: si.complexity,
            is_deferred: si.is_deferred,
            is_additional: si.is_additional,
            template_name: si.template_name,
            estimated_hours: si.estimated_hours,
            planner_notes: si.planner_notes,
            created_at: si.created_at,
            scope_name: si.scope?.name,
            scope_status: si.scope?.status,
          })),
        },
        workpacks: eventWorkpacks,
        activities: eventActivities,
        schedule,
        execution: {
          recentLogs: eventLogs,
          lastUpdate: eventLogs[0]?.recorded_at ?? null,
        },
        progress: {
          identicalActivities: identicalByEvent.get(eventId) ?? [],
        },
      };
    });

    // Handle orphan data (workpacks/scope without event_id)
    const orphanWorkpacks = workpacks
      .filter((wp) => !wp.event_id)
      .map((wp) => ({
        ...wp,
        progress: workpackProgressMap.get(wp.id) ?? null,
      }));

    const orphanScopeItems = scopeItems.filter((si) => !si.scope?.event_id);

    const orphanWorkpackIds = new Set(orphanWorkpacks.map((wp) => wp.id));
    const orphanActivities = activities.filter((a) => a.workpack_id && orphanWorkpackIds.has(a.workpack_id));

    if (orphanWorkpacks.length > 0 || orphanScopeItems.length > 0) {
      const orphanActivityIds = new Set(orphanActivities.map((a) => a.id));
      events.push({
        event: { id: 'unassigned', name: 'Unassigned', status: 'unassigned' as any },
        scope: {
          items: orphanScopeItems.map((si) => ({
            id: si.id,
            reason: si.reason,
            discipline: si.discipline,
            priority: si.priority,
            complexity: si.complexity,
            is_deferred: si.is_deferred,
            is_additional: si.is_additional,
            template_name: si.template_name,
            estimated_hours: si.estimated_hours,
            planner_notes: si.planner_notes,
            created_at: si.created_at,
            scope_name: si.scope?.name,
            scope_status: si.scope?.status,
          })),
        },
        workpacks: orphanWorkpacks,
        activities: orphanActivities,
        schedule: {
          totalActivities: orphanActivities.length,
          criticalActivities: orphanActivities.filter((a) => a.is_critical).length,
          activitiesWithNegativeFloat: orphanActivities.filter(
            (a) => a.total_float !== null && Number(a.total_float) < 0
          ).length,
          earliestPlannedStart: orphanActivities
            .map((a) => a.planned_start)
            .filter(Boolean)
            .sort()[0] ?? null,
          latestPlannedEnd: orphanActivities
            .map((a) => a.planned_end)
            .filter(Boolean)
            .sort()
            .reverse()[0] ?? null,
        },
        execution: {
          recentLogs: recentLogs.filter((log) => orphanActivityIds.has(log.activity_id)),
          lastUpdate: null,
        },
        progress: { identicalActivities: [] },
      });
    }

    return NextResponse.json({
      equipment: asset,
      events,
    });
  } catch (err: any) {
    console.error('[GET /assets/360] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
