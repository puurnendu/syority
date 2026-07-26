import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]/wbs
 * Returns a flat list of WBS nodes for the project (client builds the tree).
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
    const { error } = await guardApi('workpacks.view');
    if (error) return error;

    const { id: projectId } = await params;
    const orgId = session.user.organization_id;

    try {
        const firstActivity = await prisma.activity.findFirst({
            where: { project_id: projectId, organization_id: orgId },
            select: { event_id: true },
        });

        const eventId = firstActivity?.event_id;
        if (!eventId) {
            return NextResponse.json({ data: [] });
        }

        const nodes = await prisma.wbsNode.findMany({
            where: { organization_id: orgId, event_id: eventId },
            orderBy: { order: 'asc' },
            select: { id: true, code: true, name: true, parent_id: true, order: true },
        });

        return NextResponse.json({ data: nodes });
    } catch (err: any) {
        console.error('[WBS GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});

/**
 * POST /api/projects/[id]/wbs
 * Adds a new WBS node, appended as the last sibling under the given parent.
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
    const { error } = await guardApi('workpacks.edit');
    if (error) return error;

    const { id: projectId } = await params;
    const orgId = session.user.organization_id;

    try {
        const body = await req.json();
        const { name, parent_id } = body;

        // Resolve event_id via activities, then fallback to latest event
        const firstActivity = await prisma.activity.findFirst({
            where: { project_id: projectId, organization_id: orgId },
            select: { event_id: true },
        });

        let eventId = firstActivity?.event_id;

        if (!eventId) {
            const latestEvent = await prisma.event.findFirst({
                where: { organization_id: orgId },
                orderBy: { created_at: 'desc' },
            });
            eventId = latestEvent?.id;
        }

        if (!eventId) {
            return NextResponse.json(
                { error: 'No associated event found for this project. Import a schedule first or create an event.' },
                { status: 400 }
            );
        }

        // Find the max order among siblings to append at the end
        const maxOrder = await prisma.wbsNode.aggregate({
            where: { organization_id: orgId, event_id: eventId, parent_id: parent_id || null },
            _max: { order: true },
        });

        const newOrder = (maxOrder._max.order ?? -1) + 1;

        const node = await prisma.wbsNode.create({
            data: {
                organization_id: orgId,
                event_id:        eventId,
                parent_id:       parent_id || null,
                name:            name || 'New WBS Node',
                code:            'NEW',
                type:            'CUSTOM',
                order:           newOrder,
            },
            select: { id: true, code: true, name: true, parent_id: true, order: true },
        });

        return NextResponse.json({ data: node }, { status: 201 });
    } catch (err: any) {
        console.error('[WBS POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});
