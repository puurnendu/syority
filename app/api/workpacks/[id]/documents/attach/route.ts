import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workpacks/[id]/documents/attach
 * Attach one or more org library documents (DocLibrary) to this workpack.
 */
export const POST = withTenantGuard(async (req, { params }, session) => {
  try {
    const { id: workpackId } = await params;
    const orgId = session.user.organization_id;
    await assertTenantAccess('workpack', workpackId, orgId);

    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.doc_library_ids)
      ? body.doc_library_ids.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'doc_library_ids array is required' }, { status: 400 });
    }

    const workpack = await prisma.workpack.findFirst({
      where: { id: workpackId, organization_id: orgId, deleted_at: null },
      select: { id: true, site_id: true },
    });
    if (!workpack?.site_id) {
      return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
    }

    const libraryDocs = await prisma.docLibrary.findMany({
      where: { id: { in: ids }, org_id: orgId },
    });
    if (libraryDocs.length === 0) {
      return NextResponse.json({ error: 'No matching library documents found' }, { status: 404 });
    }

    const existing = await prisma.workpackDocument.findMany({
      where: {
        workpack_id: workpackId,
        organization_id: orgId,
        deleted_at: null,
        source_document_id: { in: libraryDocs.map((d) => d.id) },
      },
      select: { source_document_id: true },
    });
    const alreadyAttached = new Set(existing.map((e) => e.source_document_id));

    const created = [];
    const skipped: string[] = [];

    for (const lib of libraryDocs) {
      if (alreadyAttached.has(lib.id)) {
        skipped.push(lib.id);
        continue;
      }

      const categoryToType: Record<string, string> = {
        Drawings: 'drawing',
        Datasheets: 'datasheet',
        Procedures: 'procedure',
        Reports: 'inspection',
        'Vendor Documents': 'specification',
        'Client Documents': 'attachment',
        General: 'attachment',
      };

      const doc = await prisma.workpackDocument.create({
        data: {
          id: randomUUID(),
          organization_id: orgId,
          site_id: workpack.site_id,
          workpack_id: workpackId,
          original_filename: lib.original_name,
          storage_path: lib.storage_path,
          mime_type: lib.mime_type,
          file_size_bytes: lib.file_size != null ? BigInt(lib.file_size) : BigInt(0),
          document_type: categoryToType[lib.category] ?? 'attachment',
          title: lib.title,
          description: lib.description,
          include_in_pdf: false,
          source: 'library',
          source_document_id: lib.id,
          created_by: session.user.id,
          updated_at: new Date(),
        },
      });

      created.push({
        ...doc,
        file_size_bytes: doc.file_size_bytes != null ? Number(doc.file_size_bytes) : null,
      });
    }

    return NextResponse.json({
      attached: created.length,
      skipped: skipped.length,
      skipped_ids: skipped,
      documents: created,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Attach failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
