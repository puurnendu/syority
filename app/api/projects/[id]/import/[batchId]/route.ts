import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { scheduleRecalculateQueue } from '@/lib/queues';

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, hSession) => {
  const { error } = await guardApi('workpacks.manage');
  if (error) return error;

  const { id: projectId, batchId } = await params;
  const orgId = hSession.user.organization_id;

  try {
    // 1. Verify batch belongs to project & org
    let batch;
    if (batchId === 'latest') {
      batch = await prisma.scheduleImportBatch.findFirst({
        where: { project_id: projectId, organization_id: orgId },
        orderBy: { created_at: 'desc' }
      });
    } else {
      batch = await prisma.scheduleImportBatch.findFirst({
        where: { id: batchId, project_id: projectId, organization_id: orgId }
      });
    }

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    const actualBatchId = batch.id;

    // 2. Perform deletion in a transaction to ensure clean rollback
    await prisma.$transaction(async (tx) => {
      // Find all activities created by this batch
      const activities = await tx.activity.findMany({
        where: { import_batch_id: actualBatchId, organization_id: orgId },
        select: { id: true },
      });
      const activityIds = activities.map(a => a.id);

      if (activityIds.length > 0) {
        // Delete relationships referencing these activities (predecessor or successor)
        await tx.activityRelationship.deleteMany({
          where: {
            OR: [
              { predecessor_id: { in: activityIds } },
              { successor_id: { in: activityIds } },
            ]
          }
        });

        // Delete any resources tied to these activities
        await tx.activityResource.deleteMany({
          where: { activity_id: { in: activityIds } }
        });

        // Delete the activities themselves
        await tx.activity.deleteMany({
          where: { id: { in: activityIds } }
        });
      }

      // Delete the batch record
      await tx.scheduleImportBatch.delete({
        where: { id: actualBatchId }
      });
    }, { timeout: 60000 }); // 60s timeout for large batches

    // 3. Queue a recalculation of the schedule since we removed tasks
    await scheduleRecalculateQueue.add(
      'recalculate',
      { projectId, orgId },
      { jobId: `recalc-${projectId}-${Date.now()}`, removeOnComplete: 100 }
    );

    return NextResponse.json({ success: true, message: 'Import batch rolled back successfully' });

  } catch (err: any) {
    console.error(`[Import-Rollback] Failed:`, err);
    return NextResponse.json({ error: 'Failed to rollback import', details: err.message }, { status: 500 });
  }
});
