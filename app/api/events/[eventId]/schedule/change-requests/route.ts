import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScheduleChangeControlService } from '@/core/resources/ScheduleChangeControlService';

/**
 * GET /api/events/[eventId]/schedule/change-requests
 * List change requests for this event.
 *
 * Query params:
 *  - status (optional): filter by status
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as any || undefined;

  try {
    const result = await ScheduleChangeControlService.listChangeRequests(eventId, orgId, status);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[GET /schedule/change-requests] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

/**
 * POST /api/events/[eventId]/schedule/change-requests
 * Create a new change request.
 *
 * Body: { change_type, title, description?, scenario_id?, simulation_data?, ... }
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();

    if (!body.title || !body.change_type) {
      return NextResponse.json({ error: 'title and change_type are required' }, { status: 400 });
    }

    const id = await ScheduleChangeControlService.createChangeRequest({
      event_id: eventId,
      organization_id: orgId,
      change_type: body.change_type,
      title: body.title,
      description: body.description,
      scenario_id: body.scenario_id,
      simulation_data: body.simulation_data,
      activities_affected: body.activities_affected,
      float_consumed: body.float_consumed,
      project_finish_delta: body.project_finish_delta,
      constraints_resolved: body.constraints_resolved,
      submitted_by: session.user.id,
    });

    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /schedule/change-requests] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
