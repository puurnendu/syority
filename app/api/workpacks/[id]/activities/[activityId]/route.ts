import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';
import { checkActivityIdAvailability, generateNextActivityId } from '@/lib/activityIdGenerator';

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { id: workpackId, activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(_req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(_req);

        const activity = await prisma.activity.findFirst({
            where: { id: activityId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
        });
        if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

        await prisma.activityRelationship.deleteMany({
            where: {
                OR: [
                    { predecessor_id: activityId },
                    { successor_id: activityId },
                ],
            },
        });

        await ActivityService.deleteActivity(activityId, orgId, userId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { id: workpackId, activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        // P8: planned_start and planned_end are CALCULATED — strip from manual updates
        delete body.planned_start;
        delete body.planned_end;

        const activity = await prisma.activity.findFirst({
            where: { id: activityId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
        });
        if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

        if (body.activity_id !== undefined) {
            const check = await checkActivityIdAvailability(
                body.activity_id,
                workpackId,
                activityId
            );
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
        }

        if (!activity.activity_id) {
            body.activity_id = await generateNextActivityId(workpackId, orgId);
        }

        const userId = await getUserIdFromRequest(req);
        const updated = await ActivityService.updateActivity(activityId, orgId, body, userId);
        return NextResponse.json({ data: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
