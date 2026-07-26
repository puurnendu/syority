import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/projects/[id]/baseline
 *
 * Freezes the current activity plan into a ScheduleBaseline snapshot.
 * - Creates the baseline row (marking it as is_current=true)
 * - Sets all other baselines for this project to is_current=false
 * - Copies planned_start, planned_end, duration_hours, budgeted_cost
 *   from each Activity into a BaselineActivity row
 *
 * Body: { name?: string }   (defaults to "Baseline YYYY-MM-DD")
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId   = session.user.organization_id;
  const userId  = session.user.id;

  const body = await req.json().catch(() => ({}));
  const name  = body?.name || `Baseline ${new Date().toISOString().split('T')[0]}`;

  try {
    // 1. Fetch activities for this project
    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
        deleted_at: null,
      },
      select: {
        id: true,
        planned_start:  true,
        planned_end:    true,
        duration_hours: true,
        budgeted_cost:  true,
      },
    });

    if (activities.length === 0) {
      return NextResponse.json(
        { error: 'No activities found for this project' },
        { status: 422 }
      );
    }

    // 2. Atomic transaction: demote old current, create new baseline + its activities
    const result = await prisma.$transaction(async (tx) => {
      // Demote any existing current baseline for this project
      await tx.scheduleBaseline.updateMany({
        where: { project_id: projectId, is_current: true },
        data:  { is_current: false },
      });

      // Create the new baseline header
      const baseline = await tx.scheduleBaseline.create({
        data: {
          organization_id: orgId,
          project_id: projectId,
          name,
          created_by: userId,
          is_current: true,
        },
      });

      // Snapshot each activity's schedule into BaselineActivity
      const baselineActivities = activities.map(a => ({
        baseline_id:    baseline.id,
        activity_id:    a.id,
        planned_start:  a.planned_start  ?? new Date(),
        planned_finish: a.planned_end    ?? new Date(),
        duration:       Number(a.duration_hours ?? 0) / 10, // convert hours → working days (10h/day default)
        budgeted_cost:  a.budgeted_cost  ?? null,
      }));

      await tx.baselineActivity.createMany({ data: baselineActivities });

      return { baselineId: baseline.id, activityCount: activities.length };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('[Baseline] Error creating baseline:', err);
    return NextResponse.json(
      { error: 'Failed to create baseline', details: err.message },
      { status: 500 }
    );
  }
});
