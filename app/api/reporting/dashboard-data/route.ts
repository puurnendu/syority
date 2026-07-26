import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/reporting/dashboard-data
 *
 * Aggregates real-time data from the scheduling engine for the Reporting Dashboard:
 *  - EVM summary (SPI, CPI, SV, CV, EAC, BAC) across all active projects
 *  - Lookahead: activities starting/finishing within 72 hours
 *  - Unit progress: grouped by wbs_code prefix
 *  - Punch summary: counts by category + status
 */
export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const orgId = session.user.organization_id;
  const now   = new Date();
  const in72h = new Date(now.getTime() + 72 * 3600 * 1000);

  try {
    // ── Activities: all for org ──────────────────────────────────────────────
    const activities = await prisma.activity.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: {
        id: true,
        wbs_code: true,
        progress_percent: true,
        budgeted_cost: true,
        actual_cost: true,
        early_start: true,
        early_finish: true,
        actual_start: true,
        actual_end: true,
        is_critical: true,
        status: true,
        description: true,
        workpack: { select: { title: true, workpack_id_code: true, project_id: true } },
      },
    });

    // ── EVM across all projects ──────────────────────────────────────────────
    const BAC  = activities.reduce((s, a) => s + Number(a.budgeted_cost ?? 0), 0) || 1;
    const ACWP = activities.reduce((s, a) =>
      a.actual_start ? s + Number(a.actual_cost ?? 0) : s, 0);

    // BCWP: sum of budgeted_cost * progress%/100
    const BCWP = activities.reduce((s, a) =>
      s + Number(a.budgeted_cost ?? 0) * (Number(a.progress_percent ?? 0) / 100), 0);

    // BCWS: budget of activities whose early_finish has passed (simplistic planned)
    const BCWS = activities.reduce((s, a) => {
      if (!a.early_finish) return s;
      const fin  = new Date(a.early_finish);
      const start = a.early_start ? new Date(a.early_start) : now;
      const dur  = fin.getTime() - start.getTime();
      if (dur <= 0) return s + Number(a.budgeted_cost ?? 0);
      const frac = Math.min(1, (now.getTime() - start.getTime()) / dur);
      return s + Number(a.budgeted_cost ?? 0) * Math.max(0, frac);
    }, 0);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const spi = BCWS > 0 ? r2(BCWP / BCWS) : 1;
    const cpi = ACWP > 0 ? r2(BCWP / ACWP) : 1;
    const eac = cpi > 0 ? r2(BAC / cpi) : BAC;

    const evm = {
      bac:  r2(BAC),
      bcws: r2(BCWS),
      bcwp: r2(BCWP),
      acwp: r2(ACWP),
      spi,
      cpi,
      sv:   r2(BCWP - BCWS),
      cv:   r2(BCWP - ACWP),
      eac,
      etc:  r2(eac - ACWP),
      vac:  r2(BAC - eac),
    };

    // ── Lookahead: activities starting/finishing in next 72 hours ────────────
    const lookahead = activities
      .filter(a =>
        !a.actual_end &&
        a.early_start &&
        new Date(a.early_start) >= now &&
        new Date(a.early_start) <= in72h
      )
      .map(a => ({
        id:          a.id,
        description: a.description,
        early_start: a.early_start,
        early_finish: a.early_finish,
        status:      a.status,
        is_critical: a.is_critical,
        workpack:    a.workpack?.title ?? null,
        project_id:  a.workpack?.project_id ?? null,
      }))
      .sort((a, b) => new Date(a.early_start!).getTime() - new Date(b.early_start!).getTime())
      .slice(0, 50);

    // ── Unit progress: group by first segment of wbs_code ───────────────────
    const unitMap = new Map<string, { planned: number; actual: number; count: number }>();
    for (const a of activities) {
      const unit = (a.wbs_code ?? 'Unassigned').split('.')[0] || 'Unassigned';
      const cur  = unitMap.get(unit) ?? { planned: 0, actual: 0, count: 0 };
      cur.planned += 100; // planned = 100% per activity
      cur.actual  += Number(a.progress_percent ?? 0);
      cur.count++;
      unitMap.set(unit, cur);
    }
    const unitProgress = Array.from(unitMap.entries()).map(([unit, v]) => ({
      unit,
      planned: 100,
      actual:  v.count > 0 ? Math.round(v.actual / v.count) : 0,
      count:   v.count,
    }));

    // ── Critical path activities ─────────────────────────────────────────────
    const criticalPath = activities
      .filter(a => a.is_critical)
      .map(a => ({
        id:          a.id,
        description: a.description,
        early_start: a.early_start,
        early_finish: a.early_finish,
        status:      a.status,
        workpack:    a.workpack?.title ?? null,
      }));

    // ── Punch summary ────────────────────────────────────────────────────────
    const punches = await prisma.punchListItem.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { category: true, status: true },
    }).catch(() => []); // graceful if PunchListItem not yet populated

    const punchMap: Record<string, Record<string, number>> = {};
    for (const p of punches) {
      const cat = p.category ?? 'Other';
      const st  = p.status  ?? 'open';
      (punchMap[cat] ??= {})[st] = ((punchMap[cat]?.[st]) ?? 0) + 1;
    }
    const punchSummary = Object.entries(punchMap).map(([category, statuses]) => ({
      category,
      ...statuses,
    }));

    return NextResponse.json({
      evm,
      lookahead,
      unitProgress,
      criticalPath,
      punchSummary,
      activityCount:  activities.length,
      criticalCount:  criticalPath.length,
      dataDate:       now.toISOString().split('T')[0],
    });
  } catch (err: any) {
    console.error('[Reporting] dashboard-data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
