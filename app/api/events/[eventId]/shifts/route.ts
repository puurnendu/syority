import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourcePlanningService } from '@/core/resources/ResourcePlanningService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;

    const shifts = await ResourcePlanningService.listShifts(eventId, orgId);
    return NextResponse.json({ data: shifts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;
    const body = await req.json();

    const created = await ResourcePlanningService.createShift(eventId, orgId, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
