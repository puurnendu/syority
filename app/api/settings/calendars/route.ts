import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/settings/calendars  → list org calendars
 * POST /api/settings/calendars  → create calendar
 */

export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
    const orgId = session.user.organization_id;
    const calendars = await prisma.scheduleCalendar.findMany({
        where: { organization_id: orgId },
        orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json(calendars);
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
    const orgId = session.user.organization_id;
    const body = await req.json();

    if (!body.name?.trim()) {
        return NextResponse.json({ error: 'Calendar name is required' }, { status: 400 });
    }

    // If setting as default, clear existing default first
    if (body.is_default) {
        await prisma.scheduleCalendar.updateMany({
            where: { organization_id: orgId, is_default: true },
            data: { is_default: false },
        });
    }

    const calendar = await prisma.scheduleCalendar.create({
        data: {
            organization_id: orgId,
            name: body.name.trim(),
            work_days: body.work_days ?? [1, 2, 3, 4, 5], // Mon–Fri default
            hours_per_day: body.hours_per_day ?? 10,
            exceptions: body.exceptions ?? [],
            is_default: body.is_default ?? false,
        },
    });
    return NextResponse.json(calendar, { status: 201 });
});
