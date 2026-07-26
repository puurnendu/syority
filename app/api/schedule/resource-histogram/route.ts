import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/schedule/resource-histogram
 *
 * Returns a per-day resource load for the org (optionally filtered by eventId).
 * Response shape:
 *   { dates: string[], series: { disciplineCode: string; disciplineName: string; color: string; values: number[] }[] }
 *
 * Algorithm:
 *   1. Fetch activities with planned_start + duration_hours, including discipline + resources
 *   2. Expand each activity across its working days (using 10h/day default)
 *   3. Aggregate manpower (ActivityResource.quantity) per day per discipline
 *   4. If no ActivityResource records, fall back to manpower_count field
 */
export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || null;
    const startStr = searchParams.get('startDate');
    const endStr = searchParams.get('endDate');

    const windowStart = startStr ? new Date(startStr) : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
    })();
    const windowEnd = endStr ? new Date(endStr) : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 90);
        return d;
    })();

    const where: any = {
        organization_id: orgId,
        deleted_at: null,
        planned_start: { not: null },
        duration_hours: { not: null, gt: 0 },
    };
    if (eventId) where.event_id = eventId;

    const activities = await prisma.activity.findMany({
        where,
        select: {
            id: true,
            planned_start: true,
            duration_hours: true,
            manpower_count: true,
            discipline_id: true,
            discipline: { select: { id: true, name: true, code: true, color: true } },
            resources: {
                select: { id: true, resource_id: true, quantity: true },
            },
        },
    });

    // Build date range array (day strings YYYY-MM-DD)
    const dates: string[] = [];
    const cur = new Date(windowStart);
    cur.setUTCHours(0, 0, 0, 0);
    const end = new Date(windowEnd);
    end.setUTCHours(0, 0, 0, 0);
    while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }

    const dateIndex = new Map(dates.map((d, i) => [d, i]));

    // Map: disciplineCode -> { meta, values[] }
    const disciplineMap = new Map<string, {
        disciplineCode: string;
        disciplineName: string;
        color: string;
        values: number[];
    }>();

    const HOURS_PER_DAY = 10;

    for (const act of activities) {
        if (!act.planned_start || !act.duration_hours) continue;

        const start = new Date(act.planned_start);
        start.setUTCHours(0, 0, 0, 0);
        const durationHours = Number(act.duration_hours);
        const durationDays = Math.max(1, Math.ceil(durationHours / HOURS_PER_DAY));

        // Determine headcount for this activity
        let headcount = 0;
        if (act.resources.length > 0) {
            headcount = act.resources.reduce((sum, r) => sum + (Number(r.quantity) || 1), 0);
        } else if (act.manpower_count) {
            headcount = act.manpower_count;
        } else {
            headcount = 1; // default: 1 person
        }

        // Discipline key
        const discCode = act.discipline?.code ?? 'UNASSIGNED';
        const discName = act.discipline?.name ?? 'Unassigned';
        const discColor = act.discipline?.color ?? '#6B7280';

        if (!disciplineMap.has(discCode)) {
            disciplineMap.set(discCode, {
                disciplineCode: discCode,
                disciplineName: discName,
                color: discColor,
                values: new Array(dates.length).fill(0),
            });
        }
        const series = disciplineMap.get(discCode)!;

        // Spread headcount across activity's working days
        for (let day = 0; day < durationDays; day++) {
            const d = new Date(start);
            d.setDate(d.getDate() + day);
            const dayStr = d.toISOString().slice(0, 10);
            const idx = dateIndex.get(dayStr);
            if (idx !== undefined) {
                series.values[idx] += headcount;
            }
        }
    }

    const series = Array.from(disciplineMap.values())
        .sort((a, b) => a.disciplineCode.localeCompare(b.disciplineCode));

    return NextResponse.json({ dates, series });
});
