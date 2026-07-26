import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { SchedulingService } from '@/modules/Scheduling/Services/SchedulingService';

// Fields that accept a Date value from the DB
const DATE_FIELDS = ['planned_start', 'planned_end', 'actual_start', 'actual_end'] as const;

// All fields the schedule grid is allowed to update
const ALLOWED_FIELDS = [
  'activity_number', 'description', 'responsible', 'discipline',
  'notes', 'crew_size', 'duration_hours', 'remaining_duration',
  'status', 'progress_percent', 'wbs_code', 'sequence_number',
  'planned_start', 'planned_end', 'actual_start', 'actual_end',
] as const;

export const PUT = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.edit');
  if (error) return error;

  const { id: projectId, activityId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();

    const dataToUpdate: Record<string, any> = {};

    for (const field of ALLOWED_FIELDS) {
      if (body[field] === undefined) continue;

      if ((DATE_FIELDS as readonly string[]).includes(field)) {
        // Accept ISO strings or null; store as Date for Prisma
        const raw = body[field];
        dataToUpdate[field] = raw ? new Date(raw) : null;
      } else if (field === 'progress_percent' || field === 'crew_size' ||
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
        workpack: { project_id: projectId },
      },
      data: dataToUpdate,
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Activity not found or access denied' }, { status: 404 });
    }

    // Trigger CPM recalculation when schedule-affecting fields change
    const scheduleFields: string[] = ['planned_start', 'planned_end', 'actual_start', 'actual_end', 'duration_hours'];
    if (scheduleFields.some(f => dataToUpdate[f] !== undefined)) {
      try { await SchedulingService.calculateProjectSchedule(projectId, orgId); } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API] Failed to update activity:', err);
    return NextResponse.json({ error: 'Update failed', details: err.message }, { status: 500 });
  }
});

