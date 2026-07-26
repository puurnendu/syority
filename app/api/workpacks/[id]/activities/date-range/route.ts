import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const workpack = await prisma.workpack.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        select: { id: true },
    });
    if (!workpack) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await prisma.activity.aggregate({
        where: {
            workpack_id: id,
            deleted_at: null,
        },
        _min: { planned_start: true },
        _max: { planned_end: true },
        _count: { id: true },
    });

    return NextResponse.json({
        min_start: result._min.planned_start?.toISOString() ?? null,
        max_end: result._max.planned_end?.toISOString() ?? null,
        count: result._count.id,
    });
}
