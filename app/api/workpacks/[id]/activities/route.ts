import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';
import { prisma } from '@/lib/prisma';
import {
    generateNextActivityId,
    checkActivityIdAvailability,
} from '@/lib/activityIdGenerator';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const activities = await prisma.activity.findMany({
            where: { workpack_id: id, organization_id: orgId, deleted_at: null },
            orderBy: { sequence_number: 'asc' },
            include: { discipline: true, resources: true, udf_values: true, predecessors: true },
        });
        return NextResponse.json({ data: activities });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const userId = await getUserIdFromRequest(req);
        const wp = await prisma.workpack.findFirst({
            where: { id, organization_id: orgId },
            select: { organization_id: true, site_id: true, unit_code: true, title: true, event_id: true },
        });
        if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        let finalActivityId: string;
        if (body.activity_id?.trim()) {
            const check = await checkActivityIdAvailability(body.activity_id.trim(), id);
            if (!check.available) {
                return NextResponse.json(
                    {
                        error: 'Activity ID already exists in this event',
                        suggestion: check.suggestion,
                        code: 'ACTIVITY_ID_DUPLICATE',
                    },
                    { status: 409 }
                );
            }
            finalActivityId = body.activity_id.trim();
        } else {
            finalActivityId = await generateNextActivityId(id, wp.organization_id);
        }

        const activity = await ActivityService.createActivity({
            ...body,
            workpack_id: id,
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            created_by: userId,
            activity_id: finalActivityId,
            event_id: wp.event_id ?? undefined,
        });
        return NextResponse.json({ data: activity }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
