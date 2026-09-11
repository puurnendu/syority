import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScheduleBaselineService } from '@/core/resources/ScheduleBaselineService';

/**
 * GET /api/events/[eventId]/schedule/baselines/[baselineId]
 * Get a baseline with its activity snapshots.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { baselineId } = await params;
  const orgId = session.user.organization_id;

  try {
    const result = await ScheduleBaselineService.getBaseline(baselineId, orgId);
    if (!result) {
      return NextResponse.json({ error: 'Baseline not found' }, { status: 404 });
    }
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[GET /schedule/baselines/[id]] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

/**
 * DELETE /api/events/[eventId]/schedule/baselines/[baselineId]
 * Delete a baseline (cannot delete the active baseline).
 */
export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { baselineId } = await params;
  const orgId = session.user.organization_id;

  try {
    await ScheduleBaselineService.deleteBaseline(baselineId, orgId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /schedule/baselines/[id]] Error:', err);
    const status = err.message.includes('active baseline') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});

/**
 * POST /api/events/[eventId]/schedule/baselines/[baselineId]
 * Actions: assign as current baseline.
 *
 * Body: { action: 'assign' }
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId, baselineId } = await params;
  const orgId = session.user.organization_id;

  try {
    const { action } = await req.json();

    if (action === 'assign') {
      await ScheduleBaselineService.assignBaseline(baselineId, eventId, orgId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /schedule/baselines/[id]] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
