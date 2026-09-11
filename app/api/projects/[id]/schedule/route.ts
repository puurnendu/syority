import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
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

  // OD9.2 §8/§15: "loose" activities (no workpack) can no longer be scoped to a Project.
  //
  // This queried `prisma.activity.findMany({ where: { project_id, workpack_id: null, ... } })`.
  // `Activity.project_id` was retired in OD9.1 and §8 forbids reintroducing it, so there is
  // no representable link between a workpack-less Activity and a Project. Because the filter
  // object was typed `any`, TypeScript did not flag it — but Prisma rejects the unknown field
  // at runtime, so this GET threw on every call and the Project Schedule view was dead.
  //
  // A Project's activities are reached only through the sanctioned path
  // Project -> Workpack -> Activity. The response key is retained as an empty array so the
  // shared ScheduleContainer client contract is unchanged.
  const looseActivities: { id: string }[] = [];

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

  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
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
  void params;
  void session;

  // R0.4-E: STO CPM is Event-authoritative. This Project route no longer
  // infers Event from Project. Use POST /api/schedule/calculate with event_id.
  return NextResponse.json(
    {
      error: 'STO campaign CPM is Event-authoritative. Use POST /api/schedule/calculate with event_id.',
      code: 'EVENT_REQUIRED',
    },
    { status: 409 }
  );
});
