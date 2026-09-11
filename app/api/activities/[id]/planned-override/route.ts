import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { PlannedDateAuthority } from '@/core/schedule/PlannedDateAuthority';
import { PlannedDateAuthorityError } from '@/core/schedule/plannedDateGuard';
import { enqueueEventScheduleRecalculate } from '@/core/schedule/enqueueEventScheduleRecalculate';

/**
 * POST /api/activities/:id/planned-override
 * Audited TYPE 5 pin of a CPM-derived planned date.
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id: activityId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const body = await req.json();
    const updated = await PlannedDateAuthority.applyOverride({
      organizationId: orgId,
      activityId,
      userId,
      reason: String(body.reason ?? ''),
      planned_start: body.planned_start,
      planned_end: body.planned_end,
      source: body.source ? String(body.source) : 'ui',
    });

    await enqueueEventScheduleRecalculate({
      organizationId: orgId,
      eventId: updated.event_id,
      workpackId: updated.workpack_id,
    });

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    if (err instanceof PlannedDateAuthorityError) {
      return NextResponse.json(
        { error: err.message, rejectedFields: err.rejectedFields, code: err.code },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : 'Override failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

/**
 * DELETE /api/activities/:id/planned-override
 * Drop the pin and restore the last CPM-derived planned dates.
 */
export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id: activityId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;

  try {
    const updated = await PlannedDateAuthority.clearOverride(orgId, activityId, userId);
    await enqueueEventScheduleRecalculate({
      organizationId: orgId,
      eventId: updated.event_id,
      workpackId: updated.workpack_id,
    });
    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    if (err instanceof PlannedDateAuthorityError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Clear override failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
