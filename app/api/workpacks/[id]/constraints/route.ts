import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { notifyOrgAdmins } from '@/lib/notifications/createNotification';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const constraints = await prisma.constraintLog.findMany({
        where: {
            workpack_id: id,
            organization_id: orgId,
            deleted_at: null,
        },
        include: {
            attachments: {
                select: {
                    id: true,
                    filename: true,
                    file_size: true,
                    created_at: true,
                },
            },
        },
        orderBy: [{ severity: 'desc' }, { raised_date: 'desc' }],
    });

    const counts = {
        open: constraints.filter((c) => c.status === 'open').length,
        in_progress: constraints.filter((c) => c.status === 'in_progress').length,
        resolved: constraints.filter((c) => c.status === 'resolved').length,
        closed: constraints.filter((c) => c.status === 'closed').length,
    };

    return NextResponse.json({ constraints, counts });
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId, userId } = orgScope(session!);
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body?.title?.trim()) {
        return NextResponse.json(
            { error: 'Title is required' },
            { status: 400 }
        );
    }

    const workpack = await prisma.workpack.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        select: { id: true, workpack_id_code: true },
    });
    if (!workpack) {
        return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
    }

    const existingCount = await prisma.constraintLog.count({
        where: { workpack_id: id, deleted_at: null },
    });
    const seq = String(existingCount + 1).padStart(3, '0');
    const wpRef = workpack.workpack_id_code ?? id.slice(0, 8);
    const conNum = `CON-${wpRef}-${seq}`;

    const userName = (session!.user as any).name ?? (session!.user as any).email;

    const constraint = await prisma.constraintLog.create({
        data: {
            organization_id: orgId,
            workpack_id: id,
            constraint_number: conNum,
            title: body.title.trim(),
            description: body.description?.trim() ?? '',
            category: body.category ?? 'technical',
            severity: body.severity ?? 'medium',
            status: 'open',
            raised_by: body.raised_by ?? userName ?? undefined,
            owner: body.owner ?? null,
            target_resolution: body.target_resolution
                ? new Date(body.target_resolution)
                : null,
            resolution_steps: body.resolution_steps ?? null,
            is_in_central_register: true,
        },
    });

    if (constraint.severity === 'critical' || constraint.severity === 'high') {
        void notifyOrgAdmins(orgId, {
            type: 'constraint_open',
            title: `${constraint.severity === 'critical' ? '🔴 Critical' : '🟠 High'} constraint raised`,
            body: `${constraint.constraint_number}: ${constraint.title}`,
            link: `/workpacks/${id}#constraints`,
            entityType: 'constraint',
            entityId: constraint.id,
        });
    }

    return NextResponse.json(constraint, { status: 201 });
}
