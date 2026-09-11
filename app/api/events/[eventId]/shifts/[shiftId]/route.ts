import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourcePlanningService } from '@/core/resources/ResourcePlanningService';

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId, shiftId } = await params;
    const orgId = session.user.organization_id;
    const body = await req.json();

    const updated = await ResourcePlanningService.updateShift(eventId, orgId, shiftId, body);
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId, shiftId } = await params;
    const orgId = session.user.organization_id;

    await ResourcePlanningService.deleteShift(eventId, orgId, shiftId);
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
