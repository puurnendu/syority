import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { QaClearanceService } from '@/modules/QA/Services/QaClearanceService';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const clearances = await QaClearanceService.getClearancesByActivity(activityId, orgId);
        return NextResponse.json({ data: clearances });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    try {
        const { id, activityId } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = await getUserIdFromRequest(req);
        const body = await req.json();

        const clearance = await QaClearanceService.createClearance({
            organization_id: orgId,
            workpack_id: id,
            activity_id: activityId,
            cleared_by: userId,
            cleared_at: new Date(),
            ...body
        });

        return NextResponse.json({ data: clearance });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
