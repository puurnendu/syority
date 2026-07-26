import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { SchedulingService } from '@/modules/Scheduling/Services/SchedulingService';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  const contractorName = (session.user as any).contractor_affiliation;

  const workpackWhere: any = { 
    project_id: projectId, 
    organization_id: orgId, 
    deleted_at: null 
  };

  const activityFilter: any = {
    deleted_at: null,
    OR: [
      { schedule_source: 'workpack' },
      { schedule_source: null },
      { schedule_source: 'imported' }
    ]
  };

  if (contractorName) {
    // Filter activities by UDF value matching contractor affiliation
    activityFilter.udf_values = {
      some: {
        value_string: contractorName
      }
    };
    
    // Also only show workpacks that contain at least one such activity
    workpackWhere.activities = {
      some: activityFilter
    };
  }

  const workpacks = await prisma.workpack.findMany({
    where: workpackWhere,
    include: {
      activities: {
        where: activityFilter,
        orderBy: { sequence_number: 'asc' },
        include: { udf_values: true }
      }
    },
  });

  const looseActivityWhere: any = {
    project_id: projectId,
    workpack_id: null,
    organization_id: orgId,
    deleted_at: null,
    OR: [
      { schedule_source: 'workpack' },
      { schedule_source: null },
      { schedule_source: 'imported' }
    ]
  };

  if (contractorName) {
    looseActivityWhere.udf_values = {
      some: {
        value_string: contractorName
      }
    };
  }

  const looseActivities = await prisma.activity.findMany({
    where: looseActivityWhere,
    orderBy: { sequence_number: 'asc' },
    include: { udf_values: true }
  });


  const allActivityIds = [
    ...workpacks.flatMap(wp => wp.activities.map(a => a.id)),
    ...looseActivities.map(a => a.id)
  ];
  
  const relationships: any[] = [];
  if (allActivityIds.length > 0) {
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < allActivityIds.length; i += CHUNK_SIZE) {
      const chunk = allActivityIds.slice(i, i + CHUNK_SIZE);
      const chunkRels = await prisma.activityRelationship.findMany({
        where: {
          organization_id: orgId,
          OR: [
            { predecessor_id: { in: chunk } },
            { successor_id: { in: chunk } }
          ]
        }
      });
      relationships.push(...chunkRels);
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId, organization_id: orgId },
    select: { id: true, name: true }
  });

  const uniqueRels = Array.from(new Map(relationships.map(r => [r.id, r])).values());

  // Fetch the current baseline if it exists
  const currentBaseline = await prisma.scheduleBaseline.findFirst({
    where: { project_id: projectId, organization_id: orgId, is_current: true }
  });

  let baselineActivities: any[] = [];
  if (currentBaseline) {
    baselineActivities = await prisma.baselineActivity.findMany({
      where: { baseline_id: currentBaseline.id, activity_id: { in: allActivityIds } }
    });
  }

  return NextResponse.json({ 
    project, 
    workpacks, 
    looseActivities, 
    relationships: uniqueRels,
    baselineActivities
  });
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  try {
    // calculateProjectSchedule now returns { success, count, activities }
    // where `activities` is the full set of recalculated activities with all
    // CPM fields populated — the frontend can use this directly to refresh the
    // Gantt without a separate GET request.
    const result = await SchedulingService.calculateProjectSchedule(projectId, orgId);

    return NextResponse.json({
      success:    result.success,
      count:      result.count,
      activities: result.activities,  // ← Gantt can consume this immediately
    });
  } catch (err: any) {
    console.error('CPM Calculation Error:', err);
    return NextResponse.json(
      { error: 'Failed to calculate CPM', details: err.message },
      { status: 500 }
    );
  }
});
