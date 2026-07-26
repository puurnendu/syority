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

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 100);

    const rows = await prisma.auditLog.findMany({
        where: {
            organization_id: orgId,
            auditable_type: 'Workpack',
            auditable_id: id,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
            id: true,
            event: true,
            user_email: true,
            user_name: true,
            created_at: true,
            old_values: true,
            new_values: true,
            changed_fields: true,
        },
    });

    const logs = rows.map((r) => {
        const changed = (r.changed_fields as string[] | null)?.[0];
        const oldV = r.old_values as Record<string, unknown> | null;
        const newV = r.new_values as Record<string, unknown> | null;
        return {
            id: r.id,
            action: r.event,
            description: r.event,
            user_email: r.user_email ?? undefined,
            performed_by: r.user_name ?? undefined,
            created_at: r.created_at.toISOString(),
            field_name: changed ?? undefined,
            old_value: changed && oldV ? (oldV[changed] ?? null) : undefined,
            new_value: changed && newV ? (newV[changed] ?? null) : undefined,
        };
    });

    return NextResponse.json({ logs });
}
