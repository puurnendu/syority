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

  const activityWhere: any = {
    project_id: projectId,
    organization_id: orgId,
    schedule_source: 'imported',
    deleted_at: null,
  };

  if (contractorName) {
    activityWhere.udf_values = {
      some: {
        value_string: contractorName
      }
    };
  }

  // 1. Fetch all activities tagged as 'imported' for this project
  const activities = await prisma.activity.findMany({
    where: activityWhere,
    include: {
      import_batch: true,
      udf_values: true
    },
    orderBy: {
      activity_number: 'asc',
    },
  });

  // 2. Fetch relationships for these activities
  const activityIds = activities.map((a) => a.id);
  const relationships = await prisma.activityRelationship.findMany({
    where: {
      organization_id: orgId,
      OR: [
        { predecessor_id: { in: activityIds } },
        { successor_id: { in: activityIds } },
      ],
    },
  });

  // 3. Fetch import batches for history/context
  const batches = await prisma.scheduleImportBatch.findMany({
    where: {
      project_id: projectId,
      organization_id: orgId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  return NextResponse.json({
    activities,
    relationships,
    batches,
  });
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;
  
  const url = new URL(req.url);
  const batchId = url.searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json({ error: 'Batch ID required for rollback' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Find activities in this batch
      const activities = await tx.activity.findMany({
        where: {
          import_batch_id: batchId,
          organization_id: orgId,
        },
        select: { id: true },
      });

      const activityIds = activities.map((a) => a.id);

      if (activityIds.length > 0) {
        // Delete relationships
        await tx.activityRelationship.deleteMany({
          where: {
            OR: [
              { predecessor_id: { in: activityIds } },
              { successor_id: { in: activityIds } },
            ],
          },
        });

        // Delete activities
        await tx.activity.deleteMany({
          where: {
            id: { in: activityIds },
          },
        });
      }

      // Delete the batch record
      await tx.scheduleImportBatch.delete({
        where: {
          id: batchId,
          organization_id: orgId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Import Rollback Error]:', err);
    return NextResponse.json({ error: 'Failed to rollback import', details: err.message }, { status: 500 });
  }
});
