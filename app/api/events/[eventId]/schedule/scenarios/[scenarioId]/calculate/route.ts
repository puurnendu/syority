import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScenarioCalculationService } from '@/core/schedule/scenario/ScenarioCalculationService';

/**
 * POST /api/events/[eventId]/schedule/scenarios/[scenarioId]/calculate
 * Trigger scenario calculation.
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { scenarioId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const result = await ScenarioCalculationService.calculate(
      scenarioId,
      orgId,
      userId
    );
    
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});
