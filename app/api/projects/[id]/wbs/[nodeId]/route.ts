import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/projects/[id]/wbs/[nodeId]
 * Update a WBS node (name, code, parent_id, order). Project-scoped.
 *
 * DELETE /api/projects/[id]/wbs/[nodeId]
 * Recursively delete a WBS node and all its children. Project-scoped.
 */

async function resolveEventId(projectId: string, orgId: string): Promise<string | null> {
    const firstActivity = await prisma.activity.findFirst({
        where: { project_id: projectId, organization_id: orgId },
        select: { event_id: true },
    });
    if (firstActivity?.event_id) return firstActivity.event_id;

    const latestEvent = await prisma.event.findFirst({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
    });
    return latestEvent?.id ?? null;
}

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
    const { error } = await guardApi('workpacks.edit');
    if (error) return error;

    const { id: projectId, nodeId } = await params;
    const orgId = session.user.organization_id;

    try {
        const eventId = await resolveEventId(projectId, orgId);
        if (!eventId) {
            return NextResponse.json({ error: 'No event found for this project.' }, { status: 400 });
        }

        // Verify node belongs to this project's event
        const node = await prisma.wbsNode.findFirst({
            where: { id: nodeId, organization_id: orgId, event_id: eventId },
            select: { id: true, locked: true },
        });
        if (!node) return NextResponse.json({ error: 'WBS node not found.' }, { status: 404 });
        if (node.locked) return NextResponse.json({ error: 'This node is locked and cannot be edited.' }, { status: 403 });

        const body = await req.json();
        const { name, code, parent_id, order } = body;

        const updateData: Record<string, unknown> = {};
        if (name     !== undefined) updateData.name      = name;
        if (code     !== undefined) updateData.code      = code;
        if (order    !== undefined) updateData.order     = Number(order);
        if (parent_id !== undefined) updateData.parent_id = parent_id;

        const updated = await prisma.wbsNode.update({
            where: { id: nodeId },
            data: updateData,
            select: { id: true, code: true, name: true, parent_id: true, order: true },
        });

        return NextResponse.json({ data: updated });
    } catch (err: any) {
        console.error('[WBS PATCH nodeId]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
    const { error } = await guardApi('workpacks.edit');
    if (error) return error;

    const { id: projectId, nodeId } = await params;
    const orgId = session.user.organization_id;

    try {
        const eventId = await resolveEventId(projectId, orgId);
        if (!eventId) {
            return NextResponse.json({ error: 'No event found for this project.' }, { status: 400 });
        }

        const node = await prisma.wbsNode.findFirst({
            where: { id: nodeId, organization_id: orgId, event_id: eventId },
            select: { id: true, locked: true },
        });
        if (!node) return NextResponse.json({ error: 'WBS node not found.' }, { status: 404 });
        if (node.locked) return NextResponse.json({ error: 'Cannot delete a locked node.' }, { status: 403 });

        async function deleteRecursive(id: string) {
            const children = await prisma.wbsNode.findMany({
                where: { parent_id: id },
                select: { id: true, locked: true },
            });
            for (const child of children) {
                if (child.locked) throw new Error('Cannot delete: a child node is locked.');
                await deleteRecursive(child.id);
            }
            await prisma.wbsNode.delete({ where: { id } });
        }

        await deleteRecursive(nodeId);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[WBS DELETE nodeId]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});
