import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';

/**
 * POST /api/events/[eventId]/schedule/scenarios/[scenarioId]/overrides
 * Add or update an activity override.
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { scenarioId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { activity_id, duration_hours, planned_start, planned_end } = body;
    
    const override = await ScenarioPlanningService.setActivityOverride(
      scenarioId,
      orgId,
      userId,
      { activity_id, duration_hours, planned_start, planned_end }
    );
    
    return NextResponse.json(override);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});

/**
 * DELETE /api/events/[eventId]/schedule/scenarios/[scenarioId]/overrides
 * Remove an activity override.
 */
export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { scenarioId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const { activity_id } = body;
    
    const success = await ScenarioPlanningService.removeActivityOverride(
      scenarioId,
      orgId,
      activity_id
    );
    
    return NextResponse.json({ success });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});
