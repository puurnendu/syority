import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  
  const orgId = session.user.organization_id;
  const contractorName = (session.user as any).contractor_affiliation;

  const workpackWhere: any = { 
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
    activityFilter.udf_values = { some: { value_string: contractorName } };
    workpackWhere.activities = { some: activityFilter };
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
    looseActivityWhere.udf_values = { some: { value_string: contractorName } };
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

  const uniqueRels = Array.from(new Map(relationships.map(r => [r.id, r])).values());

  return NextResponse.json({ workpacks, looseActivities, relationships: uniqueRels });
});
