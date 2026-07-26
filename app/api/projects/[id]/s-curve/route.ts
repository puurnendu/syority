import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the Monday of the ISO week that contains `date`. */
function isoWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay(); // ISO: Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the Sunday (end) of the ISO week that contains `date`. */
function isoWeekEnd(date: Date): Date {
  const start = isoWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** YYYY-Www label e.g. "2026-W12" */
function weekLabel(weekStart: Date): string {
  const year = weekStart.getFullYear();
  const jan4 = new Date(year, 0, 4); // ISO: Jan 4 is always in W1
  const weekNo =
    Math.ceil(
      ((weekStart.getTime() - isoWeekStart(jan4).getTime()) / 86_400_000 + 1) / 7
    );
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  try {
    // 1. Project dates
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { plannedSdDate: true, plannedSuDate: true },
    });

    if (!project?.plannedSdDate || !project?.plannedSuDate) {
      return NextResponse.json(
        { error: 'Project is missing planned start/finish dates' },
        { status: 422 }
      );
    }

    const projectStart  = new Date(project.plannedSdDate);
    const projectFinish = new Date(project.plannedSuDate);
    const dataDate      = new Date(); // today; replace with project.data_date when added
    dataDate.setHours(23, 59, 59, 999);

    // 2. Activities
    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
        deleted_at: null,
      },
      select: {
        id: true,
        planned_start: true,
        planned_end: true,
        early_start: true,
        early_finish: true,
        actual_start: true,
        actual_end: true,
        progress_percent: true,
        budgeted_cost: true,
        actual_cost: true,
        duration_hours: true,
        is_critical: true,
      },
    });

    const criticalCount = activities.filter(a => a.is_critical).length;

    // 3. Current baseline (prefer ScheduleBaseline; fall back to Activity planned dates)
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: { project_id: projectId, is_current: true },
      include: { activities: true },
    });

    // Build a map of baseline activity data keyed by activity_id
    type BLActivity = {
      activity_id: string;
      planned_start: Date;
      planned_finish: Date;
      budgeted_cost: number;
    };

    const blActivities: BLActivity[] = baseline
      ? baseline.activities.map(ba => ({
          activity_id: ba.activity_id,
          planned_start:  new Date(ba.planned_start),
          planned_finish: new Date(ba.planned_finish),
          budgeted_cost:  ba.budgeted_cost ?? ba.duration ?? 0,
        }))
      : activities.map(a => ({
          activity_id:   a.id,
          planned_start:  a.planned_start  ? new Date(a.planned_start)  : projectStart,
          planned_finish: a.planned_end    ? new Date(a.planned_end)    : projectFinish,
          budgeted_cost:  a.budgeted_cost  ?? Number(a.duration_hours ?? 0),
        }));

    const BAC = blActivities.reduce((s, a) => s + a.budgeted_cost, 0) || 1; // avoid /0

    // 4. Progress logs ordered by data_date asc
    const progressLogs = await prisma.progressLog.findMany({
      where: { activityId: { in: activities.map(a => a.id) } },
      select: { activityId: true, logDate: true, progressPercent: true },
      orderBy: { logDate: 'asc' },
    });

    // Build a timeline: for each activity, track its latest pct as of any date
    // Group logs per activity for O(1) lookup
    const logsByActivity = new Map<string, { date: Date; pct: number }[]>();
    for (const log of progressLogs) {
      const list = logsByActivity.get(log.activityId) ?? [];
      list.push({ date: new Date(log.logDate), pct: Number(log.progressPercent) });
      logsByActivity.set(log.activityId, list);
    }

    /** Latest % for `actId` as of `asOf` (falls back to activity.progress_percent) */
    function pctAsOf(actId: string, asOf: Date): number {
      const logs = logsByActivity.get(actId);
      if (!logs || logs.length === 0) {
        return Number(activities.find(a => a.id === actId)?.progress_percent ?? 0);
      }
      const before = logs.filter(l => l.date <= asOf);
      return before.length > 0 ? before[before.length - 1].pct : 0;
    }

    // 5. Generate weekly buckets
    type WeekBucket = {
      week: string;
      weekStart: string;
      planned: number | null;
      actual: number | null;
      forecast: number | null;
    };

    const buckets: WeekBucket[] = [];
    const cursor = isoWeekStart(projectStart);
    const finish = isoWeekStart(projectFinish);
    finish.setDate(finish.getDate() + 6); // include finish week

    // We'll compute BCWP at data_date once for the forecast baseline
    let bcwpAtDataDate   = 0;
    let bcwsAtDataDate   = 0;
    let spiAtDataDate    = 1;
    let spiCalculated    = false;

    while (cursor <= finish) {
      const weekEnd    = isoWeekEnd(cursor);
      const isHistory  = weekEnd <= dataDate;
      const label      = weekLabel(cursor);
      const weekStartStr = cursor.toISOString().split('T')[0];

      // BCWS — planned work scheduled by this week
      let bcws = 0;
      for (const bla of blActivities) {
        const duration = bla.planned_finish.getTime() - bla.planned_start.getTime();
        if (duration <= 0) {
          if (weekEnd >= bla.planned_start) bcws += bla.budgeted_cost;
          continue;
        }
        const frac = clamp(
          (weekEnd.getTime() - bla.planned_start.getTime()) / duration,
          0, 1
        );
        bcws += bla.budgeted_cost * frac;
      }
      const bcwsPct = round2((bcws / BAC) * 100);

      if (!spiCalculated && weekEnd >= dataDate && cursor <= dataDate) {
        bcwsAtDataDate = bcws;
        spiCalculated = true;
      }

      // BCWP / ACWP — only for historical weeks
      let bcwpPct: number | null = null;
      let acwpPct: number | null = null;

      if (isHistory) {
        let bcwp = 0;
        let acwp = 0;

        for (const bla of blActivities) {
          const act = activities.find(a => a.id === bla.activity_id);
          const pct = pctAsOf(bla.activity_id, weekEnd) / 100;
          bcwp += bla.budgeted_cost * pct;
          if (act?.actual_start && new Date(act.actual_start) <= weekEnd) {
            acwp += Number(act.actual_cost ?? 0);
          }
        }

        bcwpPct = round2((bcwp / BAC) * 100);
        acwpPct = round2((acwp / BAC) * 100);

        // Capture the most recent historical week as "at data_date"
        bcwpAtDataDate = bcwp;
      }

      // Forecast: future weeks only
      let forecastPct: number | null = null;
      if (!isHistory) {
        spiAtDataDate = bcwsAtDataDate > 0 ? bcwpAtDataDate / bcwsAtDataDate : 1;
        const remainingPlanned = bcwsPct - round2((bcwsAtDataDate / BAC) * 100);
        forecastPct = round2(
          round2((bcwpAtDataDate / BAC) * 100) + remainingPlanned * spiAtDataDate
        );
        forecastPct = clamp(forecastPct, 0, 100);
      }

      buckets.push({
        week:      label,
        weekStart: weekStartStr,
        planned:   bcwsPct,
        actual:    bcwpPct,
        forecast:  forecastPct,
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    // 6. EVM scalars — as of data_date
    let bcwsFinal = 0;
    let bcwpFinal = 0;
    let acwpFinal = 0;

    for (const bla of blActivities) {
      const duration = bla.planned_finish.getTime() - bla.planned_start.getTime();
      let frac = 1;
      if (duration > 0) {
        frac = clamp(
          (dataDate.getTime() - bla.planned_start.getTime()) / duration,
          0, 1
        );
      } else if (dataDate < bla.planned_start) {
        frac = 0;
      }
      bcwsFinal += bla.budgeted_cost * frac;

      const pct = pctAsOf(bla.activity_id, dataDate) / 100;
      bcwpFinal += bla.budgeted_cost * pct;

      const act = activities.find(a => a.id === bla.activity_id);
      if (act?.actual_start && new Date(act.actual_start) <= dataDate) {
        acwpFinal += Number(act.actual_cost ?? 0);
      }
    }

    const spi  = bcwsFinal > 0 ? round2(bcwpFinal / bcwsFinal) : 1;
    const cpi  = acwpFinal > 0 ? round2(bcwpFinal / acwpFinal) : 1;
    const sv   = round2(bcwpFinal - bcwsFinal);
    const cv   = round2(bcwpFinal - acwpFinal);
    const eac  = cpi > 0 ? round2(BAC / cpi) : BAC;
    const etc  = round2(eac - acwpFinal);
    const vac  = round2(BAC - eac);

    return NextResponse.json({
      sCurve:        buckets,
      evm: {
        bac:  round2(BAC),
        bcws: round2(bcwsFinal),
        bcwp: round2(bcwpFinal),
        acwp: round2(acwpFinal),
        spi,
        cpi,
        sv,
        cv,
        eac,
        etc,
        vac,
      },
      dataDate:      dataDate.toISOString().split('T')[0],
      hasBaseline:   !!baseline,
      activityCount: activities.length,
      criticalCount,
    });
  } catch (err: any) {
    console.error('[S-Curve] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate EVM data', details: err.message },
      { status: 500 }
    );
  }
});
