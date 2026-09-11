import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { calculateProgressMetrics } from '@/core/progress/ProgressCalculationService';
import type { ProgressActivityInput } from '@/core/progress/types';

/**
 * M8.13 GOVERNANCE: Schedule metrics endpoint.
 *
 * - actualProgress: sourced from authoritative ProgressCalculationService
 * - plannedProgress: time-proportional planned calculation (S-curve specific)
 * - SPI: actualProgress / plannedProgress (execution SPI, not EVM cost-SPI)
 * - curveData: presentation-only S-curve rendering
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  const workpacks = await prisma.workpack.findMany({
    where: { project_id: projectId, organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      event_id: true,
      activities: {
        where: { deleted_at: null },
        select: {
          id: true,
          workpack_id: true,
          event_id: true,
          duration_hours: true,
          progress_percent: true,
          planned_start: true,
          planned_end: true,
          status: true,
        }
      }
    }
  });

  const rawActivities = workpacks.flatMap(wp => wp.activities);

  // ── Authoritative actual progress via ProgressCalculationService ───────────
  const progressInput: ProgressActivityInput[] = rawActivities.map(a => ({
    activityId: a.id,
    durationHours: Number(a.duration_hours ?? 0),
    progressPercent: a.progress_percent ?? 0,
    status: a.status ?? 'not_started',
    workpackId: a.workpack_id ?? null,
    eventId: a.event_id ?? null,
  }));
  const metrics = calculateProgressMetrics(progressInput);
  const actualProgress = metrics.weightedProgress;

  // ── Time-proportional planned progress (S-curve specific logic) ────────────
  const today = new Date();
  let totalDuration = 0;
  let plannedDurationToDate = 0;

  rawActivities.forEach(act => {
    const dur = Number(act.duration_hours?.toString() || 0);
    totalDuration += dur;

    if (act.planned_end && act.planned_start) {
      if (act.planned_end <= today) {
        plannedDurationToDate += dur;
      } else if (act.planned_start <= today && act.planned_end > today) {
        const totalMs = act.planned_end.getTime() - act.planned_start.getTime();
        const elapsedMs = today.getTime() - act.planned_start.getTime();
        if (totalMs > 0) {
          const ratio = Math.max(0, Math.min(1, elapsedMs / totalMs));
          plannedDurationToDate += dur * ratio;
        }
      }
    }
  });

  const plannedProgress = totalDuration > 0 ? (plannedDurationToDate / totalDuration) * 100 : 0;
  const spi = plannedProgress === 0 ? 1 : actualProgress / plannedProgress;

  // ── S-Curve data points (PRESENTATION-ONLY) ───────────────────────────────
  // Phase 0 (E2E lineage audit P0-6 / A13): the previous version served a
  // FABRICATED actual series — `actualProgress * (i / 14)`, a straight-line
  // extrapolation presented as historical fact. There is no per-day actual
  // progress store in this schema, so no actual series is emitted. Every
  // planned point below traces to stored planned_start/planned_end dates.
  const curveData = [];
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 14);

  for (let i = 0; i <= 28; i++) {
     const day = new Date(startDay);
     day.setDate(day.getDate() + i);

     let dayPlannedAccum = 0;
     rawActivities.forEach(act => {
       const dur = Number(act.duration_hours?.toString() || 0);
       if (act.planned_end && act.planned_start) {
         if (act.planned_end <= day) {
            dayPlannedAccum += dur;
         } else if (act.planned_start <= day) {
            const totMs = act.planned_end.getTime() - act.planned_start.getTime();
            const elMs = day.getTime() - act.planned_start.getTime();
            dayPlannedAccum += dur * Math.max(0, Math.min(1, elMs / totMs));
         }
       }
     });

     curveData.push({
       date: day.toISOString().split('T')[0],
       planned: totalDuration > 0 ? (dayPlannedAccum / totalDuration) * 100 : 0,
       // No fabricated actuals: per-day actual history is not stored.
       actual: null,
     });
  }

  return NextResponse.json({
    spi: Number(spi.toFixed(3)),
    actualProgress: Number(actualProgress.toFixed(1)),
    plannedProgress: Number(plannedProgress.toFixed(1)),
    curveData,
  });
});
