import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

type RelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

/**
 * Sprint 1a — lag is stored as canonical working MINUTES (lag_minutes).
 * The previous boundary divided hours by a hardcoded 8 into whole-day
 * lag_days, destroying sub-day lag. lag_days is no longer written here.
 */
function lagHoursToMinutes(hours: number | null | undefined): number {
    if (hours == null || Number.isNaN(hours)) return 0;
    return Math.round(Number(hours) * 60);
}

// POST — Add one predecessor with optional type and lag
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);
        const body = await req.json();
        const predecessorId = body.predecessorId ?? body.predecessor_id;
        if (!predecessorId) return NextResponse.json({ error: 'predecessorId required' }, { status: 400 });

        const activity = await prisma.activity.findFirst({
            where: { id: activityId, organization_id: orgId, deleted_at: null },
            select: { id: true, event_id: true },
        });
        if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

        // M11-R0: Cross-event relationship validation
        const predecessorActivity = await prisma.activity.findFirst({
            where: { id: predecessorId, organization_id: orgId, deleted_at: null },
            select: { id: true, event_id: true },
        });
        if (!predecessorActivity) return NextResponse.json({ error: 'Predecessor activity not found' }, { status: 404 });
        if (activity.event_id && predecessorActivity.event_id && activity.event_id !== predecessorActivity.event_id) {
            return NextResponse.json({
                error: 'Cross-event relationships are not allowed. Predecessor and successor must belong to the same shutdown event.',
            }, { status: 400 });
        }

        const type: RelationshipType = body.type ?? 'FS';
        const lagHours = body.lagHours ?? 0;

        const created = await prisma.activityRelationship.create({
            data: {
                organization_id: orgId,
                predecessor_id: predecessorId,
                successor_id: activityId,
                relationship_type: type,
                lag_minutes: lagHoursToMinutes(lagHours),
                created_by: userId,
            },
            include: { predecessor: { select: { id: true, sequence_number: true, description: true, activity_number: true } } },
        });
        return NextResponse.json({ data: created }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

// PUT — Replace all predecessors for this activity
export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);
        const body = await req.json();

        const activity = await prisma.activity.findFirst({
            where: { id: activityId, organization_id: orgId, deleted_at: null },
            select: { id: true, event_id: true },
        });
        if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

        await prisma.activityRelationship.deleteMany({
            where: { successor_id: activityId },
        });

        const predecessorIds: string[] = body.predecessor_ids ?? [];
        const predecessorsPayload: { predecessorId: string; type?: RelationshipType; lagHours?: number }[] = body.predecessors ?? predecessorIds.map((predId: string) => ({ predecessorId: predId }));

        const toCreate = predecessorsPayload.length > 0
            ? predecessorsPayload
            : predecessorIds.map((predId: string) => ({ predecessorId: predId }));

        for (const item of toCreate) {
            const predId = item.predecessorId ?? (typeof item === 'string' ? item : null);
            if (!predId) continue;

            // M11-R0: Cross-event relationship validation
            if (activity.event_id) {
                const predActivity = await prisma.activity.findFirst({
                    where: { id: predId, organization_id: orgId, deleted_at: null },
                    select: { event_id: true },
                });
                if (predActivity?.event_id && predActivity.event_id !== activity.event_id) {
                    return NextResponse.json({
                        error: `Cross-event relationship not allowed for predecessor ${predId}.`,
                    }, { status: 400 });
                }
            }

            const type = (item as { type?: RelationshipType }).type ?? 'FS';
            const lagHours = (item as { lagHours?: number }).lagHours ?? 0;
            await prisma.activityRelationship.create({
                data: {
                    organization_id: orgId,
                    predecessor_id: predId,
                    successor_id: activityId,
                    relationship_type: type,
                    lag_minutes: lagHoursToMinutes(lagHours),
                    created_by: userId,
                },
            });
        }

        const predecessors = await prisma.activityRelationship.findMany({
            where: { successor_id: activityId },
            include: { predecessor: { select: { id: true, sequence_number: true, description: true, activity_number: true } } },
        });

        return NextResponse.json({ data: predecessors });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
