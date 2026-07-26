import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { parseMsProjectXml } from '@/modules/Scheduling/parsers/MsProjectXmlParser';
import { scheduleRecalculateQueue } from '@/lib/queues';
import { setImportStatus, clearImportStatus } from '@/lib/importStatus';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const POST = withTenantGuard(async (req: NextRequest, { params }, hSession) => {
  const { error } = await guardApi('workpacks.view');
  if (error) {
    console.error(`[MS-Project Import] Forbidden for user ${hSession?.user?.id}, role: ${(hSession?.user as any)?.role}, org: ${hSession?.user?.organization_id}`);
    return error;
  }

  const { id: projectId } = await params;
  const orgId  = hSession.user.organization_id;
  const userId = hSession.user.id;
  const siteId = hSession.user.site_id as string | undefined;

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
    // ── 2. Read XML content ──────────────────────────────────────────────────
    await setImportStatus(projectId, userId, 'Step 1/5: Loading file into memory...');
    console.time('[MS-Project] File Read');
    const xmlString = await file.text();
    console.timeEnd('[MS-Project] File Read');

    // ── 3. Parse ─────────────────────────────────────────────────────────────
    await setImportStatus(projectId, userId, 'Step 2/5: Parsing XML project structure...');
    console.time('[MS-Project] Parsing');
    let parsed: { 
      activities: Awaited<ReturnType<typeof parseMsProjectXml>>['activities']; 
      relationships: Awaited<ReturnType<typeof parseMsProjectXml>>['relationships'];
      wbsNodes: Awaited<ReturnType<typeof parseMsProjectXml>>['wbsNodes'];
    };
    try {
      parsed = await parseMsProjectXml(xmlString, projectId, orgId, workpackId);
    } catch (parseErr: any) {
      console.timeEnd('[MS-Project] Parsing');
      await clearImportStatus(projectId, userId);
      return NextResponse.json(
        { error: 'XML parse failed', details: parseErr.message },
        { status: 400 }
      );
    }
    console.timeEnd('[MS-Project] Parsing');

    if (parsed.activities.length === 0) {
      await clearImportStatus(projectId, userId);
      return NextResponse.json({ error: 'No tasks found in XML (check for UID=0 summary task)' }, { status: 422 });
    }

    // ── 3.5 Resolve Site ID ──────────────────────────────────────────────────
    await setImportStatus(projectId, userId, 'Step 3/5: Resolving project location...');
    // We need a valid site_id. First try the session, then the project itself.
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
      
      // If still no site_id, fallback to first activity (legacy behavior)
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
      console.error(`[MS-Project-Import] Failed to resolve site_id for project ${projectId}`);
      return NextResponse.json({ error: 'Failed to resolve site_id. Please ensure your project or user has an assigned site.' }, { status: 400 });
    }

    // ── 4. Upsert activities + rebuild relationships in one transaction ───────
    let activityCount = 0;
    let relCount = 0;

    await setImportStatus(projectId, userId, `Step 4/5: Synchronizing ${parsed.activities.length} activities...`);
    try {
      console.time('[MS-Project] DB Transaction');
      const result = await prisma.$transaction(async (tx) => {
        
        // 1. Create the Import Batch record
        const batch = await tx.scheduleImportBatch.create({
          data: {
            organization_id:    orgId,
            project_id:         projectId,
            format:             'ms_project',
            filename:           file.name,
            activity_count:     parsed.activities.length,
            relationship_count: parsed.relationships.length,
            imported_by:        userId,
          }
        });

        const externalToDbId = new Map<string, string>();
        const wbsExternalToDbId = new Map<string, string>();

        // 1.5 Sync WBS Nodes in chunks
        if (parsed.wbsNodes.length > 0) {
            await setImportStatus(projectId, userId, `Step 3.5/5: Synchronizing ${parsed.wbsNodes.length} WBS nodes...`);
            
            // Resolve event_id or create a default one
            let event = await tx.event.findFirst({
                where: { organization_id: orgId, site_id: resolvedSiteId, name: { contains: 'Imported' } }
            });

            if (!event) {
                event = await tx.event.create({
                    data: {
                        organization_id: orgId,
                        site_id:          resolvedSiteId,
                        name:             `Imported Project (${file.name})`,
                        code:             `IMP-${Date.now().toString().slice(-4)}`,
                        status:           'planning',
                    }
                });
            }

            const wbsToCreate = parsed.wbsNodes.map(node => ({
                id:              node.id, // Use pre-generated UUID
                organization_id: orgId,
                event_id:        event.id,
                parent_id:       node.parent_id || null, // Already resolved in parser
                code:            node.code,
                name:            node.name,
                type:            'IMPORT',
                order:           0,
            }));

            // Create WBS nodes in a single batch
            await tx.wbsNode.createMany({
                data: wbsToCreate,
                skipDuplicates: true,
            });
        }

        // 2. Bulk Create NEW activities in chunks
        console.time(`[MS-Project] Bulk Create ${parsed.activities.length}`);
        const CREATION_CHUNK_SIZE = 2500;
        
        // Resolve event_id for the activities
        let finalEventId: string | null = null;
        if (parsed.wbsNodes.length > 0) {
            const firstWbs = await tx.wbsNode.findFirst({ where: { organization_id: orgId, name: { contains: 'Imported' } }, orderBy: { created_at: 'desc' } });
            finalEventId = firstWbs?.event_id || null;
        }

        const activitiesToCreate = parsed.activities.map(a => ({
          id:               a.id, // Use pre-generated UUID
          organization_id:  orgId,
          site_id:          resolvedSiteId,
          event_id:         finalEventId,
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
          if (activitiesToCreate.length > 2500) {
            await setImportStatus(projectId, userId, `Step 4/5: Saving activities (${Math.min(i + CREATION_CHUNK_SIZE, activitiesToCreate.length)}/${activitiesToCreate.length})...`);
          }
          await tx.activity.createMany({
            data: activitiesToCreate.slice(i, i + CREATION_CHUNK_SIZE) as any,
            skipDuplicates: true,
          });
        }
        console.timeEnd(`[MS-Project] Bulk Create ${parsed.activities.length}`);

        // 3. Relationships Mapping (Simplified: No fetch-back needed!)
        await setImportStatus(projectId, userId, `Step 5/5: Finalizing ${parsed.relationships.length} task relationships...`);
        
        parsed.activities.forEach(a => {
          externalToDbId.set(a.external_id, a.id);
        });
        console.time(`[MS-Project] Create Relat. ${parsed.relationships.length}`);
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
        console.timeEnd(`[MS-Project] Create Relat. ${parsed.relationships.length}`);

        return { activityCount: activitiesToCreate.length, relCount: relRows.length, batchId: batch.id };
      }, {
        timeout: 180000, // 180 seconds (3 mins) for very large projects
      });
      console.timeEnd('[MS-Project] DB Transaction');

      activityCount = result.activityCount;
      relCount = result.relCount;
    } catch (txErr: any) {
      console.error('[MS-Project-Import] Transaction failed:', txErr);
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

    // Final cleanup
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
