import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourceScenarioComparisonService } from '@/core/resources/ResourceScenarioComparisonService';
import { LevelingSimulationResult } from '@/core/resources/ResourceLevelingService';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { eventId } = await params;
    const orgId = session.user.organization_id;
    const body: LevelingSimulationResult = await req.json();

    if (!body || !body.scenario_id || !body.proposed_changes) {
      return NextResponse.json({ error: 'Invalid scenario result payload' }, { status: 400 });
    }

    const report = await ResourceScenarioComparisonService.compareScenario(
      eventId,
      orgId,
      body
    );
    
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
});
