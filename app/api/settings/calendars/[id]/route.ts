import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET    /api/settings/calendars/[id]  → get one calendar
 * PATCH  /api/settings/calendars/[id]  → update calendar
 * DELETE /api/settings/calendars/[id]  → delete calendar (hard delete — calendars have no deleted_at)
 */

export const GET = withTenantGuard(async (_req: NextRequest, ctx: Ctx, session) => {
    const orgId = session.user.organization_id;
    const { id } = await ctx.params;
    const calendar = await prisma.scheduleCalendar.findFirst({
        where: { id, organization_id: orgId },
    });
    if (!calendar) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    return NextResponse.json(calendar);
});

export const PATCH = withTenantGuard(async (req: NextRequest, ctx: Ctx, session) => {
    const orgId = session.user.organization_id;
    const { id } = await ctx.params;
    const body = await req.json();

    const existing = await prisma.scheduleCalendar.findFirst({
        where: { id, organization_id: orgId },
    });
    if (!existing) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });

    // If setting as default, clear existing default first
    if (body.is_default) {
        await prisma.scheduleCalendar.updateMany({
            where: { organization_id: orgId, is_default: true, id: { not: id } },
            data: { is_default: false },
        });
    }

    const updated = await prisma.scheduleCalendar.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.work_days !== undefined && { work_days: body.work_days }),
            ...(body.hours_per_day !== undefined && { hours_per_day: body.hours_per_day }),
            ...(body.exceptions !== undefined && { exceptions: body.exceptions }),
            ...(body.is_default !== undefined && { is_default: body.is_default }),
        },
    });
    return NextResponse.json(updated);
});

export const DELETE = withTenantGuard(async (_req: NextRequest, ctx: Ctx, session) => {
    const orgId = session.user.organization_id;
    const { id } = await ctx.params;
    const existing = await prisma.scheduleCalendar.findFirst({
        where: { id, organization_id: orgId },
    });
    if (!existing) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    if (existing.is_default) {
        return NextResponse.json(
            { error: 'Cannot delete the default calendar. Set another calendar as default first.' },
            { status: 400 }
        );
    }
    await prisma.scheduleCalendar.delete({ where: { id } });
    return NextResponse.json({ success: true });
});
