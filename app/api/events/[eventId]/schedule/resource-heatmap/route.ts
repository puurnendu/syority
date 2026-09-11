import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourcePlanningService } from '@/core/resources/ResourcePlanningService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const rawData = await ResourcePlanningService.getDemandVsCapacity(
      eventId,
      orgId,
      { startDate, endDate }
    );
    
    // The raw data already contains daily entries. We will just pass it to the frontend which will construct the heatmap.
    return NextResponse.json(rawData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
});
