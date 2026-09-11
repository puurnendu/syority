import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const category = url.searchParams.get('category');
    const workpack = url.searchParams.get('workpack_id');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = 50;

    const where: Record<string, unknown> = {
        organization_id: orgId,
        is_in_central_register: true,
        deleted_at: null,
    };
    if (status) (where as any).status = status;
    if (severity) (where as any).severity = severity;
    if (category) (where as any).category = category;
    if (workpack) (where as any).workpack_id = workpack;

    const [items, total] = await Promise.all([
        prisma.constraintLog.findMany({
            where,
            include: {
                workpack: {
                    select: {
                        workpack_id_code: true,
                        title: true,
                    },
                },
            },
            orderBy: [{ severity: 'desc' }, { raised_date: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.constraintLog.count({ where }),
    ]);

    return NextResponse.json({ items, total, page });
}
