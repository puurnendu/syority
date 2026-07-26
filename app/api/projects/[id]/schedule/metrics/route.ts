import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  const workpacks = await prisma.workpack.findMany({
    where: { project_id: projectId, organization_id: orgId, deleted_at: null },
    select: {
      activities: {
        where: { deleted_at: null },
        select: {
          duration_hours: true,
          progress_percent: true,
          planned_start: true,
          planned_end: true,
        }
      }
    }
  });

  const activities = workpacks.flatMap(wp => wp.activities);

  const today = new Date();
  let totalDuration = 0;
  let earnedDuration = 0;
  let plannedDurationToDate = 0;

  activities.forEach(act => {
    // duration_hours is Decimal in Prisma
    const dur = Number(act.duration_hours?.toString() || 0);
    totalDuration += dur;
    earnedDuration += dur * ((act.progress_percent || 0) / 100);

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

  const actualProgress = totalDuration > 0 ? (earnedDuration / totalDuration) * 100 : 0;
  const plannedProgress = totalDuration > 0 ? (plannedDurationToDate / totalDuration) * 100 : 0;
  const spi = plannedProgress === 0 ? 1 : actualProgress / plannedProgress;

  // Generate generic S-Curve points (last 14 days to next 14 days)
  const curveData = [];
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 14);

  for (let i = 0; i <= 28; i++) {
     const day = new Date(startDay);
     day.setDate(day.getDate() + i);
     
     let dayPlannedAccum = 0;
     activities.forEach(act => {
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
       // We don't have historical actual progress logged per day in this simple schema, 
       // so actual progress is only rendered up to 'today' as a straight extrapolation for now.
       actual: day <= today ? (actualProgress * (i / 14)) : null, // Mock actual trend
     });
  }

  return NextResponse.json({
    spi: Number(spi.toFixed(3)),
    actualProgress: Number(actualProgress.toFixed(1)),
    plannedProgress: Number(plannedProgress.toFixed(1)),
    curveData,
  });
});
