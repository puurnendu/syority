import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const PUT = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;

  const { id: activityId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    
    // Only allow specific updates
    const updates: any = {};
    const allowed = [
      'activity_number', 'progress_percent', 'status', 'duration_hours', 'crew_size', 
      'description', 'notes', 'responsible', 'discipline', 'actual_start', 'actual_end', 
      'remaining_duration', 'actual_duration', 'physical_percent_complete', 
      'duration_percent_complete', 'unit_percent_complete'
    ];
    
    for (const field of allowed) {
      if (body[field] !== undefined) {
        if (field === 'actual_start' || field === 'actual_end') {
           updates[field] = body[field] ? new Date(body[field]) : null;
        } else if (['progress_percent', 'physical_percent_complete', 'duration_percent_complete', 'unit_percent_complete'].includes(field)) {
           updates[field] = parseInt(body[field], 10) || 0;
        } else if (['duration_hours', 'actual_duration', 'remaining_duration'].includes(field)) {
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
