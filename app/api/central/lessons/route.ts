import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const impact = url.searchParams.get('impact');
    const workpack_id = url.searchParams.get('workpack_id');
    const in_register = url.searchParams.get('in_register'); // 'true' = only central register
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = 50;

    const where: Record<string, unknown> = {
        organization_id: orgId,
        deleted_at: null,
    };
    if (status) (where as any).status = status;
    if (category) (where as any).category = category;
    if (impact) (where as any).impact = impact;
    if (workpack_id) (where as any).workpack_id = workpack_id;
    if (in_register === 'true') (where as any).is_in_central_register = true;

    const [items, total] = await Promise.all([
        prisma.lessonLearned.findMany({
            where,
            include: {
                workpack: {
                    select: {
                        workpack_id_code: true,
                        title: true,
                    },
                },
            },
            orderBy: [{ created_at: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.lessonLearned.count({ where }),
    ]);

    return NextResponse.json({ items, total, page });
}

/** Bulk publish: set is_in_central_register = true for selected ids */
export async function PATCH(req: NextRequest) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
        return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    await prisma.lessonLearned.updateMany({
        where: {
            id: { in: ids },
            organization_id: orgId,
            deleted_at: null,
        },
        data: {
            is_in_central_register: true,
            status: 'published',
        },
    });
    return NextResponse.json({ success: true });
}
