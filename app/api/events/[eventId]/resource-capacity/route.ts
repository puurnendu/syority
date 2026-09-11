import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourcePlanningService } from '@/core/resources/ResourcePlanningService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);

    const filters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      resourceTypeId: searchParams.get('resourceTypeId') || undefined,
      contractorId: searchParams.get('contractorId') || undefined,
      shiftId: searchParams.get('shiftId') || undefined,
    };

    const data = await ResourcePlanningService.listCapacity(eventId, orgId, filters);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;
    const body = await req.json();

    const created = await ResourcePlanningService.upsertCapacity(eventId, orgId, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
