import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { parseP6Xer } from '@/modules/Scheduling/parsers/P6XerParser';
import { scheduleRecalculateQueue } from '@/lib/queues';
import { setImportStatus, clearImportStatus } from '@/lib/importStatus';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) {
    console.error(`[P6-XER Import] Forbidden for user ${session?.user?.id}, role: ${(session?.user as any)?.role}, org: ${session?.user?.organization_id}`);
    return error;
  }

  const { id: projectId } = await params;
  const orgId  = session.user.organization_id;
  const userId = session.user.id;
  const siteId = session.user.site_id as string | undefined;

  // Read optional workpackId from query string
  const url        = new URL(req.url);
  const workpackId = url.searchParams.get('workpackId') ?? undefined;

  // ── 1. Parse multipart form ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded — send field name "file"' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `File exceeds 50 MB limit (received ${(file.size / 1024 / 1024).toFixed(1)} MB)` }, { status: 413 });
  }

  try {
    // ── 2. Read file content ──────────────────────────────────────────────────
    await setImportStatus(projectId, userId, 'Step 1/5: Loading file into memory...');
    console.time('[P6-XER] File Read');
    const fileString = await file.text();
    console.timeEnd('[P6-XER] File Read');

    // ── 3. Parse ─────────────────────────────────────────────────────────────
    await setImportStatus(projectId, userId, 'Step 2/5: Parsing XER project structure...');
    console.time('[P6-XER] Parsing');
    let parsed: { activities: Awaited<ReturnType<typeof parseP6Xer>>['activities']; relationships: Awaited<ReturnType<typeof parseP6Xer>>['relationships'] };
    try {
      parsed = await parseP6Xer(fileString, projectId, orgId, workpackId);
    } catch (parseErr: any) {
      console.timeEnd('[P6-XER] Parsing');
      await clearImportStatus(projectId, userId);
      return NextResponse.json(
        { error: 'XER parse failed', details: parseErr.message },
        { status: 400 }
      );
    }
    console.timeEnd('[P6-XER] Parsing');

    if (parsed.activities.length === 0) {
      await clearImportStatus(projectId, userId);
      return NextResponse.json({ error: 'No tasks found in file' }, { status: 422 });
    }

    // ── 3.5 Resolve Site ID ──────────────────────────────────────────────────
    await setImportStatus(projectId, userId, 'Step 3/5: Resolving project location...');
    let resolvedSiteId = siteId ?? '';
    if (!resolvedSiteId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      
      if (!project) {
        await clearImportStatus(projectId, userId);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      
      // Project does not contain site_id in new schema, we rely on the fallback below
      resolvedSiteId = '';
      
      if (!resolvedSiteId) {
        const anyActivity = await prisma.activity.findFirst({
          where: { site_id: { not: '' } },
          select: { site_id: true },
        });
        resolvedSiteId = anyActivity?.site_id ?? '';
      }
    }

    if (!resolvedSiteId) {
        await clearImportStatus(projectId, userId);
        console.error(`[P6-XER-Import] Failed to resolve site_id for project ${projectId}`);
        return NextResponse.json({ error: 'Failed to resolve site_id. Please ensure your project or user has an assigned site.' }, { status: 400 });
    }

    // ── 4. Upsert activities + rebuild relationships in one transaction ───────
    let activityCount = 0;
    let relCount = 0;

    await setImportStatus(projectId, userId, `Step 4/5: Synchronizing ${parsed.activities.length} activities...`);
    try {
      console.time('[P6-XER] DB Transaction');
      const result = await prisma.$transaction(async (tx) => {
        
        // 1. Create the Import Batch record
        const batch = await tx.scheduleImportBatch.create({
          data: {
            organization_id:    orgId,
            project_id:         projectId,
            format:             'p6_xer',
            filename:           file.name,
            activity_count:     parsed.activities.length,
            relationship_count: parsed.relationships.length,
            imported_by:        userId,
          }
        });

        const externalToDbId = new Map<string, string>();

        // 2. Bulk Create NEW activities in chunks
        console.time(`[P6-XER] Bulk Create ${parsed.activities.length}`);
        const CREATION_CHUNK_SIZE = 2500;
        const activitiesToCreate = parsed.activities.map(a => ({
          organization_id:  orgId,
          site_id:          resolvedSiteId,
          activity_number:  a.activity_code,
          description:      a.name,
          duration_hours:   a.duration * 10,
          planned_start:    a.planned_start,
          planned_end:      a.planned_end,
          progress_percent: a.percent_complete,
          budgeted_cost:    a.budgeted_cost,
          wbs_code:         a.wbs_code || null,
          workpack_id:      null,
          project_id:       projectId,
          schedule_source:  'imported',
          import_batch_id:  batch.id,
          status:           'not_started',
          sequence_number:  0,
        }));

        for (let i = 0; i < activitiesToCreate.length; i += CREATION_CHUNK_SIZE) {
          if (activitiesToCreate.length > 5000) {
            await setImportStatus(projectId, userId, `Step 4/5: Saving activities (${Math.min(i + CREATION_CHUNK_SIZE, activitiesToCreate.length)}/${activitiesToCreate.length})...`);
          }
          await tx.activity.createMany({
            data: activitiesToCreate.slice(i, i + CREATION_CHUNK_SIZE) as any,
            skipDuplicates: true,
          });
        }
        console.timeEnd(`[P6-XER] Bulk Create ${parsed.activities.length}`);

        // Fetch back IDs for relationships in chunks to avoid PG parameter limits
        console.time('[P6-XER] Fetch IDs');
        const newlyCreated: { id: string; activity_number: string | null }[] = [];
        const FETCH_CHUNK_SIZE = 5000;
        for (let i = 0; i < parsed.activities.length; i += FETCH_CHUNK_SIZE) {
          const chunk = parsed.activities.slice(i, i + FETCH_CHUNK_SIZE);
          const chunkResult = await tx.activity.findMany({
            where: {
              organization_id: orgId,
              import_batch_id: batch.id,
              activity_number: { in: chunk.map(a => a.activity_code) }
            },
            select: { id: true, activity_number: true }
          });
          newlyCreated.push(...chunkResult);
        }
        
        newlyCreated.forEach(a => {
          const original = parsed.activities.find(tc => tc.activity_code === a.activity_number);
          if (original) externalToDbId.set(original.external_id, a.id);
        });
        console.timeEnd('[P6-XER] Fetch IDs');

        // 3. Relationships
        await setImportStatus(projectId, userId, `Step 5/5: Finalizing ${parsed.relationships.length} task relationships...`);
        console.time(`[P6-XER] Create Relat. ${parsed.relationships.length}`);
        const relRows = parsed.relationships
          .map(r => {
            const predId = externalToDbId.get(r.predecessor_external_id);
            const succId = externalToDbId.get(r.successor_external_id);
            if (!predId || !succId) return null;
            return {
              organization_id:   orgId,
              predecessor_id:    predId,
              successor_id:      succId,
              relationship_type: r.type as any,
              lag_days:          r.lag,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (relRows.length > 0) {
          const REL_CHUNK_SIZE = 5000;
          for (let i = 0; i < relRows.length; i += REL_CHUNK_SIZE) {
             await tx.activityRelationship.createMany({ 
               data: relRows.slice(i, i + REL_CHUNK_SIZE), 
               skipDuplicates: true 
             });
          }
        }
        console.timeEnd(`[P6-XER] Create Relat. ${parsed.relationships.length}`);

        return { activityCount: newlyCreated.length, relCount: relRows.length, batchId: batch.id };
      }, {
        timeout: 180000, // 180 seconds (3 mins) for very large projects
      });
      console.timeEnd('[P6-XER] DB Transaction');
      activityCount = result.activityCount;
      relCount = result.relCount;
    } catch (txErr: any) {
      console.error('[P6-XER-Import] Transaction failed:', txErr);
      await clearImportStatus(projectId, userId);
      return NextResponse.json(
        { error: 'Database transaction failed', details: txErr.message },
        { status: 500 }
      );
    }

    // ── 5. Enqueue CPM recalculation ─────────────────────────────────────────
    await scheduleRecalculateQueue.add(
      'recalculate',
      { projectId, orgId },
      { jobId: `recalc-${projectId}`, removeOnComplete: 100 }
    );

    await clearImportStatus(projectId, userId);

    return NextResponse.json({
      imported:      activityCount,
      relationships: relCount,
      queued:        true,
    });
  } catch (globalErr: any) {
    await clearImportStatus(projectId, userId);
    return NextResponse.json({ error: 'Global import error', details: globalErr.message }, { status: 500 });
  }
});
