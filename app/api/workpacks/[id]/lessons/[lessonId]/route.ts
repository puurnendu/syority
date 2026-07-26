import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId, lessonId } = await params;

    const existing = await prisma.lessonLearned.findFirst({
        where: {
            id: lessonId,
            workpack_id: workpackId,
            organization_id: orgId,
            deleted_at: null,
        },
    });
    if (!existing) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = String(body.title).slice(0, 500);
    if (body.description !== undefined) updates.description = String(body.description);
    if (body.category !== undefined) updates.category = String(body.category).slice(0, 100);
    if (body.impact !== undefined) updates.impact = String(body.impact).slice(0, 50);
    if (body.recommendation !== undefined) updates.recommendation = body.recommendation == null ? null : String(body.recommendation);
    if (body.applicable_to !== undefined) updates.applicable_to = Array.isArray(body.applicable_to) ? body.applicable_to : [];
    if (body.is_in_central_register !== undefined) updates.is_in_central_register = Boolean(body.is_in_central_register);
    if (body.status !== undefined) updates.status = String(body.status).slice(0, 50);
    if (body.reviewed_by !== undefined) updates.reviewed_by = body.reviewed_by == null ? null : String(body.reviewed_by);
    if (body.reviewed_date !== undefined) updates.reviewed_date = body.reviewed_date ? new Date(body.reviewed_date) : null;

    const lesson = await prisma.lessonLearned.update({
        where: { id: lessonId },
        data: updates as any,
    });
    return NextResponse.json(lesson);
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId, lessonId } = await params;

    const existing = await prisma.lessonLearned.findFirst({
        where: {
            id: lessonId,
            workpack_id: workpackId,
            organization_id: orgId,
            deleted_at: null,
        },
    });
    if (!existing) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    await prisma.lessonLearned.update({
        where: { id: lessonId },
        data: { deleted_at: new Date() },
    });
    return NextResponse.json({ success: true });
}
