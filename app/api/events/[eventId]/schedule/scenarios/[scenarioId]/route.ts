import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';

/**
 * GET /api/events/[eventId]/schedule/scenarios/[scenarioId]
 * Get scenario details including overrides.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { scenarioId } = await params;
  const orgId = session.user.organization_id;

  try {
    const scenario = await ScenarioPlanningService.getScenario(scenarioId, orgId);
    return NextResponse.json(scenario);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
});

/**
 * PATCH /api/events/[eventId]/schedule/scenarios/[scenarioId]
 * Update scenario name/description/status.
 */
export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { scenarioId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const { name, description, status } = body;
    let updated;
    
    if (status) {
      updated = await ScenarioPlanningService.transitionStatus(scenarioId, orgId, status);
    }
    
    if (name || description !== undefined) {
      updated = await prisma.scheduleScenario.update({
        where: { id: scenarioId, organization_id: orgId },
        data: {
          name: name !== undefined ? name : undefined,
          description: description !== undefined ? description : undefined,
        }
      });
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
});
