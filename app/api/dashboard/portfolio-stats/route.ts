import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { computePlanningProgressForSystems } from '@/lib/planningProgress';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const GET = withTenantGuard(async (req, { params }, session) => {
    const { error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    console.log('[PortfolioStats] Start for orgId:', orgId);

    const url = new URL(req.url);
    const period = url.searchParams.get('period') ?? '30';
    const eventId = url.searchParams.get('event_id') ?? undefined;
    const since = new Date(Date.now() - parseInt(period, 10) * 86_400_000);

    let systemIds: string[] = [];
    if (eventId) {
        const eventSystems = await prisma.eventSystem.findMany({
            where: { event_id: eventId },
            select: { system_id: true },
        });
        systemIds = eventSystems.map((es) => es.system_id);
    } else {
        const allSys = await prisma.system.findMany({
            where: { organization_id: orgId, deleted_at: null },
            select: { id: true },
        });
        systemIds = allSys.map((s) => s.id);
    }

    // Batch computation: fixed number of bulk queries instead of ~12 sequential
    // queries per system (previously N×12 — a connection-pool killer).
    let systemsActive = 0;
    let systemsPlanned = 0;
    const planningBySystem = await computePlanningProgressForSystems(systemIds);
    for (const c of planningBySystem.values()) {
        if (c.planningProgress > 0 && c.planningProgress < 100) systemsActive++;
        else if (c.planningProgress === 100) systemsPlanned++;
    }

    let results;
    try {
        results = await Promise.all([
            prisma.workpack.findMany({
                where: { organization_id: orgId, deleted_at: null },
                select: {
                    id: true,
                    status: true,
                    planned_start_date: true,
                    planned_end_date: true,
                    workpack_id_code: true,
                    title: true,
                },
            }).catch(e => { console.error('Error in workpack.findMany:', e); return []; }),
            prisma.constraintLog.count({
                where: {
                    organization_id: orgId,
                    status: { in: ['open', 'in_progress'] },
                    severity: { in: ['critical', 'high'] },
                    is_in_central_register: true,
                    deleted_at: null,
                },
            }).catch(e => { console.error('Error in constraintLog.count:', e); return 0; }),
            prisma.certificateInstance.count({
                where: {
                    organization_id: orgId,
                    status: { notIn: ['signed', 'rejected'] },
                    deleted_at: null,
                },
            }).catch(e => { console.error('Error in certificateInstance.count:', e); return 0; }),
            prisma.lessonLearned.count({
                where: {
                    organization_id: orgId,
                    status: 'published',
                    is_in_central_register: true,
                    deleted_at: null,
                    created_at: { gte: since },
                },
            }).catch(e => { console.error('Error in lessonLearned.count:', e); return 0; }),
            prisma.activity.groupBy({
                by: ['status'],
                where: {
                    organization_id: orgId,
                    deleted_at: null,
                },
                _count: { _all: true },
            }).catch(e => { console.error('Error in activity.groupBy status:', e); return []; }),
            prisma.constraintLog.groupBy({
                by: ['severity'],
                where: {
                    organization_id: orgId,
                    status: { in: ['open', 'in_progress'] },
                    deleted_at: null,
                },
                _count: { _all: true },
            }).catch(e => { console.error('Error in constraintLog.groupBy severity:', e); return []; }),
            prisma.workpack.groupBy({
                by: ['status'],
                where: {
                    organization_id: orgId,
                    deleted_at: null,
                },
                _count: { _all: true },
            }).catch(e => { console.error('Error in workpack.groupBy status:', e); return []; }),
            prisma.activity.groupBy({
                by: ['workpack_id'],
                where: {
                    workpack_id: { not: null },
                    organization_id: orgId,
                    deleted_at: null,
                },
                _avg: { progress_percent: true },
            }).catch(e => { console.error('Error in activity.groupBy workpack_id:', e); return []; }),
            prisma.workpack_material_lines.count({
                where: { organization_id: orgId, deleted_at: null },
            }).catch(e => { console.error('Error in workpackMaterialLine.count total:', e); return 0; }),
            prisma.workpack_material_lines.count({
                where: {
                    organization_id: orgId,
                    deleted_at: null,
                    procurement_status: 'not_requested',
                },
            }).catch(e => { console.error('Error in workpackMaterialLine.count pending:', e); return 0; }),
            prisma.jointIntegrityItem.count({
                where: { organization_id: orgId, deleted_at: null },
            }).catch(e => { console.error('Error in jointIntegrityItem.count:', e); return 0; }),
            prisma.workpack.count({
                where: { organization_id: orgId, deleted_at: null, status: 'draft' },
            }).catch(e => { console.error('Error in workpack.count draft:', e); return 0; }),
            prisma.workpack.findMany({
                where: { organization_id: orgId, deleted_at: null },
                select: { _count: { select: { activities: true } } },
            }).then((wps) => wps.filter((w) => w._count?.activities === 0).length)
              .catch(e => { console.error('Error in workpack.findMany relations:', e); return 0; }),
            prisma.blind.count({
                where: { organization_id: orgId, deleted_at: null },
            }).catch(e => { console.error('Error in blind.count:', e); return 0; }),
        ]);
    } catch (err: any) {
        console.error('[Dashboard API] Promise.all failed:', err);
        return NextResponse.json({ error: 'Failed to fetch dashboard stats', detail: err.message }, { status: 500 });
    }

    const [
        workpacks,
        openConstraints,
        pendingCerts,
        recentLessons,
        activitiesByStatus,
        constraintsBySeverity,
        workpacksByStatus,
        activityProgressByWorkpack,
        materialsTotal,
        materialsNotRequested,
        jointsTotal,
        workpacksDraft,
        workpacksNoActivities,
        blindsTotal,
    ] = results;

    const progressMap: Record<string, number> = {};
    for (const row of activityProgressByWorkpack) {
        if (row.workpack_id)
            progressMap[row.workpack_id] = Math.round(row._avg.progress_percent ?? 0);
    }

    const total = workpacks.length;
    const avgProgress = total > 0
        ? Math.round(
            workpacks.reduce((s, w) => s + (progressMap[w.id] ?? 0), 0) / total
        )
        : 0;

    const now = new Date();
    const overdue = workpacks.filter(w =>
        w.planned_end_date
        && new Date(w.planned_end_date) < now
        && w.status !== 'closed'
        && w.status !== 'cancelled'
    ).length;

    const weekEnd = new Date(Date.now() + 7 * 86_400_000);
    const starting = workpacks.filter(w =>
        w.planned_start_date
        && new Date(w.planned_start_date) >= now
        && new Date(w.planned_start_date) <= weekEnd
    ).length;

    const actMap: Record<string, number> = {};
    for (const a of activitiesByStatus)
        actMap[a.status ?? 'unknown'] = a._count._all;

    const sevMap: Record<string, number> = {};
    for (const c of constraintsBySeverity)
        sevMap[c.severity] = c._count._all;

    const wpStatusMap: Record<string, number> = {};
    for (const w of workpacksByStatus)
        wpStatusMap[w.status] = w._count._all;

    const overdueList = workpacks
        .filter(w =>
            w.planned_end_date
            && new Date(w.planned_end_date) < now
            && w.status !== 'closed'
            && w.status !== 'cancelled'
        )
        .sort((a, b) =>
            new Date(a.planned_end_date!).getTime()
            - new Date(b.planned_end_date!).getTime()
        )
        .slice(0, 5)
        .map(w => ({
            id: w.id,
            workpack_id_code: w.workpack_id_code,
            title: w.title,
            planned_end_date: w.planned_end_date,
            overall_progress: progressMap[w.id] ?? 0,
            days_overdue: Math.floor(
                (now.getTime() - new Date(w.planned_end_date!).getTime()) / 86_400_000
            ),
        }));

    // SPI/CPI Calculation if eventId is present
    let spi = 0;
    let cpi = 0;
    if (eventId) {
        const activities = await prisma.activity.findMany({
            where: { workpack: { project_id: eventId }, deleted_at: null },
            include: { ProgressLog: true }
        });

        let ev = 0; // Earned Value
        let pv = 0; // Planned Value
        let ac = 0; // Actual Cost

        const now = new Date();
        activities.forEach(a => {
            const duration = Number(a.duration_hours || 0);
            const progress = Number(a.progress_percent || 0);
            ev += (duration * progress) / 100;

            if (a.planned_start && a.planned_end) {
                const start = new Date(a.planned_start);
                const end = new Date(a.planned_end);
                if (now > end) {
                    pv += duration;
                } else if (now > start) {
                    const total = end.getTime() - start.getTime();
                    const passed = now.getTime() - start.getTime();
                    pv += (duration * passed) / total;
                }
            }

            a.ProgressLog.forEach(log => {
                ac += Number(log.manhours_actual || 0);
            });
        });

        spi = pv > 0 ? ev / pv : 1;
        cpi = ac > 0 ? ev / ac : 1;
    }

    return NextResponse.json({
        summary: {
            total_workpacks: total,
            avg_progress: avgProgress,
            overdue,
            starting_this_week: starting,
            open_constraints: openConstraints,
            pending_certs: pendingCerts,
            recent_lessons: recentLessons,
            systems_active: systemsActive,
            systems_planned: systemsPlanned,
            materials_total: materialsTotal,
            materials_not_requested: materialsNotRequested,
            joints_total: jointsTotal,
            blinds_total: blindsTotal,
            workpacks_draft: workpacksDraft,
            workpacks_no_activities: workpacksNoActivities,
            spi: Number(spi.toFixed(2)),
            cpi: Number(cpi.toFixed(2)),
        },
        activities_by_status: actMap,
        constraints_by_severity: sevMap,
        workpacks_by_status: wpStatusMap,
        overdue_workpacks: overdueList.map(w => ({
            ...w,
            planned_end_date: w.planned_end_date instanceof Date
                ? w.planned_end_date.toISOString()
                : w.planned_end_date,
        })),
    });
});
