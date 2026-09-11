import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { listedExecutionFields, EXECUTION_FIELD_REJECT_MESSAGE } from '@/core/execution/executionFieldGuard';
import { listedPlannedDateFields, PLANNED_DATE_REJECT_MESSAGE } from '@/core/schedule/plannedDateGuard';

export const PUT = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;

  const { id: activityId } = await params;
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

    // Planning / administrative fields only
    const updates: any = {};
    const allowed = [
      'activity_number', 'duration_hours', 'crew_size',
      'description', 'notes', 'responsible', 'discipline',
      'remaining_duration',
    ];
    
    for (const field of allowed) {
      if (body[field] !== undefined) {
        if (['duration_hours', 'remaining_duration'].includes(field)) {
           updates[field] = parseFloat(body[field]) || 0;
        } else {
           updates[field] = body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No valid fields provided' });
    }

    const activity = await prisma.activity.update({
      where: { 
        id: activityId,
        organization_id: orgId
      },
      data: updates
    });

    return NextResponse.json({ activity });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;

  const { id: activityId } = await params;
  const orgId = session.user.organization_id;

  try {
    const activity = await prisma.activity.update({
      where: { 
        id: activityId,
        organization_id: orgId
      },
      data: { deleted_at: new Date() }
    });
    return NextResponse.json({ success: true, activity });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
