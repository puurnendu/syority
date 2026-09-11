import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScheduleBaselineService } from '@/core/resources/ScheduleBaselineService';

/**
 * GET /api/events/[eventId]/schedule/baselines
 * List all baselines for this event.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const baselines = await ScheduleBaselineService.listBaselines(eventId, orgId);
    return NextResponse.json({ data: baselines });
  } catch (err: any) {
    console.error('[GET /schedule/baselines] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

/**
 * POST /api/events/[eventId]/schedule/baselines
 * Create a new baseline snapshot.
 *
 * Body: { name: string, description?: string }
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const { name, description } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Baseline name is required' }, { status: 400 });
    }

    const result = await ScheduleBaselineService.createBaseline(
      eventId, orgId, name.trim(), session.user.id, description
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /schedule/baselines] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
