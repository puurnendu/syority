import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

type RelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

function lagHoursToDays(hours: number | null | undefined): number {
    if (hours == null || Number.isNaN(hours)) return 0;
    return Math.round((Number(hours) / 8) * 100) / 100;
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string; relId: string }> }
) {
    try {
        const { activityId, relId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();

        const rel = await prisma.activityRelationship.findFirst({
            where: { id: relId, successor_id: activityId, organization_id: orgId },
        });
        if (!rel) return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });

        const updateData: { relationship_type?: RelationshipType; lag_days?: number } = {};
        if (body.type != null) updateData.relationship_type = body.type as RelationshipType;
        if (body.lagHours != null) updateData.lag_days = lagHoursToDays(body.lagHours);

        const updated = await prisma.activityRelationship.update({
            where: { id: relId },
            data: updateData,
            include: { predecessor: { select: { id: true, sequence_number: true, description: true, activity_number: true } } },
        });
        return NextResponse.json({ data: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string; relId: string }> }
) {
    try {
        const { activityId, relId } = await context.params;
        const orgId = await getOrgIdFromRequest(_req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rel = await prisma.activityRelationship.findFirst({
            where: { id: relId, successor_id: activityId, organization_id: orgId },
        });
        if (!rel) return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });

        await prisma.activityRelationship.delete({ where: { id: relId } });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
