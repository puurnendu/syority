import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { enqueueEventScheduleRecalculate } from '@/core/schedule/enqueueEventScheduleRecalculate';
import { listedExecutionFields, EXECUTION_FIELD_REJECT_MESSAGE } from '@/core/execution/executionFieldGuard';
import { listedPlannedDateFields, PLANNED_DATE_REJECT_MESSAGE } from '@/core/schedule/plannedDateGuard';

// Planned schedule / configuration fields the schedule grid may update.
// Execution status/progress/actuals are M12 EWS only.
// Sprint 1b: planned_start/planned_end are CPM-derived — not in this list.
const ALLOWED_FIELDS = [
  'activity_number', 'description', 'responsible', 'discipline',
  'notes', 'crew_size', 'duration_hours', 'remaining_duration',
  'wbs_code', 'sequence_number',
] as const;

export const PUT = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { activityId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();

    const executionFields = listedExecutionFields(body);
    if (executionFields.length > 0) {
      return NextResponse.json(
        { error: EXECUTION_FIELD_REJECT_MESSAGE, rejectedFields: executionFields },
        { status: 409 }
      );
    }

    const plannedFields = listedPlannedDateFields(body);
    if (plannedFields.length > 0) {
      return NextResponse.json(
        { error: PLANNED_DATE_REJECT_MESSAGE, rejectedFields: plannedFields },
        { status: 409 }
      );
    }

    const dataToUpdate: Record<string, any> = {};

    for (const field of ALLOWED_FIELDS) {
      if (body[field] === undefined) continue;

      if (field === 'crew_size' ||
                 field === 'duration_hours' || field === 'remaining_duration' ||
                 field === 'sequence_number') {
        dataToUpdate[field] = Number(body[field]);
      } else {
        dataToUpdate[field] = body[field];
      }
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.activity.updateMany({
      where: {
        id: activityId,
        organization_id: orgId,
      },
      data: dataToUpdate,
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Activity not found or access denied' }, { status: 404 });
    }

    const scheduleFields: string[] = ['duration_hours'];
    if (scheduleFields.some(f => dataToUpdate[f] !== undefined)) {
      const activity = await prisma.activity.findFirst({
        where: { id: activityId, organization_id: orgId },
        select: { event_id: true, workpack_id: true },
      });
      await enqueueEventScheduleRecalculate({
        organizationId: orgId,
        eventId: activity?.event_id,
        workpackId: activity?.workpack_id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API] Failed to update activity:', err);
    return NextResponse.json({ error: 'Update failed', details: err.message }, { status: 500 });
  }
});

