import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourcePlanningService } from '@/core/resources/ResourcePlanningService';

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId, capacityId } = await params;
    const orgId = session.user.organization_id;
    const body = await req.json();

    const updated = await ResourcePlanningService.updateCapacity(eventId, orgId, capacityId, body);
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId, capacityId } = await params;
    const orgId = session.user.organization_id;

    await ResourcePlanningService.deleteCapacity(eventId, orgId, capacityId);
    return NextResponse.json({ data: { success: true } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
