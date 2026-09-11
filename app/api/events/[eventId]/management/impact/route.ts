/**
 * GET  /api/events/[eventId]/management/impact
 * POST /api/events/[eventId]/management/impact  (runImpactScenario — M8.9 sim only)
 *
 * GET is read-only (persisted CPM + relationship counts + resource risk).
 * POST orchestrates M8.9; does not mutate live Activity or call EWS/leveling apply.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DecisionIntelligenceService } from '@/core/m15/DecisionIntelligenceService';
import { DecisionContextError } from '@/core/m15/types';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const activityId = url.searchParams.get('activityId');
  const slipHours = Number(url.searchParams.get('slipHours') ?? '0');

  if (!activityId) {
    return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
  }
  if (!Number.isFinite(slipHours) || slipHours < 0) {
    return NextResponse.json({ error: 'slipHours must be a non-negative number' }, { status: 400 });
  }

  try {
    const data = await DecisionIntelligenceService.getImpact(orgId, eventId, activityId, slipHours);
    return NextResponse.json({ data });
  } catch (err: any) {
    if (err instanceof DecisionContextError) {
      const status = err.code === 'EVENT_REQUIRED' ? 400 : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[GET management/impact]', err);
    return NextResponse.json({ error: 'Failed to load impact' }, { status: 500 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const activityId = body.activityId as string | undefined;
  const slipHours = Number(body.slipHours ?? 0);

  if (!activityId) {
    return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
  }
  if (!Number.isFinite(slipHours) || slipHours < 0) {
    return NextResponse.json({ error: 'slipHours must be a non-negative number' }, { status: 400 });
  }

  try {
    const data = await DecisionIntelligenceService.runImpactScenario(
      orgId,
      eventId,
      userId,
      activityId,
      slipHours
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    if (err instanceof DecisionContextError) {
      const status = err.code === 'EVENT_REQUIRED' ? 400 : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[POST management/impact]', err);
    return NextResponse.json({ error: err.message || 'Failed to run impact scenario' }, { status: 400 });
  }
});
