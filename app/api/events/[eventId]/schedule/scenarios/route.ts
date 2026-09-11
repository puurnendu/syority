import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';

/**
 * GET /api/events/[eventId]/schedule/scenarios
 * List all scenarios for an event.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const scenarios = await prisma.scheduleScenario.findMany({
      where: { event_id: eventId, organization_id: orgId },
      orderBy: { created_at: 'desc' },
      include: { base_baseline: true }
    });
    return NextResponse.json(scenarios);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
});

/**
 * POST /api/events/[eventId]/schedule/scenarios
 * Create a new draft scenario.
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { name, description, base_baseline_id } = body;
    const scenario = await ScenarioPlanningService.createScenario(
      orgId,
      eventId,
      userId,
      { name, description, base_baseline_id }
    );
    return NextResponse.json(scenario, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});
