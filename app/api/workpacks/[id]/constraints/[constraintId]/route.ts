import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; constraintId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    orgScope(session!);
    const { id, constraintId } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const existing = await prisma.constraintLog.findFirst({
        where: { id: constraintId, workpack_id: id, deleted_at: null },
        select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const ud: Record<string, unknown> = {};
    if (body.title !== undefined) ud.title = String(body.title).trim();
    if (body.description !== undefined) ud.description = body.description;
    if (body.category !== undefined) ud.category = body.category;
    if (body.severity !== undefined) ud.severity = body.severity;
    if (body.status !== undefined) ud.status = body.status;
    if (body.owner !== undefined) ud.owner = body.owner;
    if (body.target_resolution !== undefined)
        ud.target_resolution = body.target_resolution ? new Date(body.target_resolution) : null;
    if (body.resolution_steps !== undefined) ud.resolution_steps = body.resolution_steps;
    if (body.impact_on_schedule !== undefined) ud.impact_on_schedule = body.impact_on_schedule;
    if (body.resolution_notes !== undefined) ud.resolution_notes = body.resolution_notes;
    if (body.status === 'resolved' && existing.status !== 'resolved') {
        ud.resolved_by = (session!.user as any).name ?? (session!.user as any).email;
        ud.resolved_date = new Date();
    }

    const updated = await prisma.constraintLog.update({
        where: { id: constraintId },
        data: ud,
        include: { attachments: true },
    });
    return NextResponse.json(updated);
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string; constraintId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id, constraintId } = await context.params;
    await prisma.constraintLog.updateMany({
        where: { id: constraintId, workpack_id: id, organization_id: orgId },
        data: { deleted_at: new Date() },
    });
    return NextResponse.json({ success: true });
}
