import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourceRiskService } from '@/core/resources/ResourceRiskService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const risks = await ResourceRiskService.getRisks(
      eventId,
      orgId,
      { startDate, endDate }
    );
    
    return NextResponse.json(risks);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
});
