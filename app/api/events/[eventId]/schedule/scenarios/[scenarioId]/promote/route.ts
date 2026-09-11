import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';

/**
 * POST /api/events/[eventId]/schedule/scenarios/[scenarioId]/promote
 * Promote a ready scenario to a Schedule Change Request.
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { scenarioId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const cr = await ScenarioPlanningService.promoteScenario(
      scenarioId,
      orgId,
      userId
    );
    
    return NextResponse.json(cr);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});
