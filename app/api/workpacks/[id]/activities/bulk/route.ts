import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body?.ids?.length || !body.updates) {
        return NextResponse.json(
            { error: 'ids and updates are required' },
            { status: 400 }
        );
    }

    const valid = await prisma.activity.findMany({
        where: {
            id: { in: body.ids as string[] },
            workpack_id: id,
            workpack: { organization_id: orgId },
            deleted_at: null,
        },
        select: { id: true },
    });
    const validIds = valid.map((a) => a.id);

    if (validIds.length === 0) {
        return NextResponse.json({ error: 'No valid activities found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.updates.status !== undefined) data.status = body.updates.status;
    if (body.updates.progress_percent !== undefined) {
        data.progress_percent = Math.min(100, Math.max(0, body.updates.progress_percent));
        if ((data.progress_percent as number) === 100) data.status = 'completed';
        else if (
            (data.progress_percent as number) > 0 &&
            body.updates.status === undefined
        ) {
            data.status = 'in_progress';
        }
    }
    if (body.updates.discipline !== undefined) data.discipline_id = body.updates.discipline;

    await prisma.activity.updateMany({
        where: { id: { in: validIds } },
        data,
    });

    return NextResponse.json({
        updated: validIds.length,
        skipped: body.ids.length - validIds.length,
    });
}
