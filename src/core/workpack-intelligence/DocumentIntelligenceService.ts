import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

const EXPECTED_DOC_TYPES = [
  'p_and_id', 'oem_manual', 'datasheet', 'inspection_report',
  'vendor_manual', 'photograph', 'lesson_learned', 'maintenance_history',
  'previous_workpack', 'ga_drawing', 'isometric',
];

/**
 * Document Intelligence Service — auto-attaches relevant documents to workpacks.
 *
 * Sources: AssetDocumentLink, Attachments, LessonLearned, previous Workpacks on same asset.
 */
export class DocumentIntelligenceService {
  /** Auto-attach all available documents for a workpack's asset */
  static async autoAttachDocuments(workpackId: string, userId: string): Promise<{
    attached: number;
    details: Array<{ name: string; type: string; source: string }>;
  }> {
    const wp = await prisma.workpack.findUnique({
      where: { id: workpackId },
      select: {
        id: true, organization_id: true, site_id: true, asset_id: true,
        asset: { select: { tag_number: true, name: true, p_and_id_numbers: true, ga_drawing_number: true, isometric_drawing_numbers: true } },
      },
    });
    if (!wp) throw new Error('Workpack not found');
    if (!wp.asset_id) throw new Error('Workpack has no linked asset');

    const details: Array<{ name: string; type: string; source: string }> = [];

    // 1. Asset document links
    const assetLinks = await prisma.assetDocumentLink.findMany({
      where: { asset_id: wp.asset_id },
      include: { document: { select: { title: true, document_type: true, original_filename: true, storage_path: true } } },
      take: 50,
    });
    for (const link of assetLinks) {
      const exists = await prisma.workpackDocument.findFirst({
        where: { workpack_id: workpackId, source_document_id: link.document_id, deleted_at: null },
      });
      if (!exists) {
        await prisma.workpackDocument.create({
          data: {
            id: randomUUID(),
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            workpack_id: workpackId,
            original_filename: link.document?.original_filename || 'auto_attached_document',
            storage_path: link.document?.storage_path || 'auto_attached',
            document_type: link.link_type || link.document?.document_type || 'reference',
            title: link.document?.title || 'Asset Document',
            description: `Auto-attached from asset ${wp.asset?.tag_number}`,
            source: 'document_intelligence',
            source_document_id: link.document_id,
            created_by: userId,
            updated_at: new Date(),
          },
        });
        details.push({ name: link.document?.title || 'Asset Document', type: link.link_type || 'reference', source: 'asset_documents' });
      }
    }

    // 2. P&ID references from asset
    if (wp.asset?.p_and_id_numbers?.length) {
      for (const pid of wp.asset.p_and_id_numbers) {
        const exists = await prisma.workpackDocument.findFirst({
          where: { workpack_id: workpackId, title: { contains: pid }, deleted_at: null },
        });
        if (!exists) {
          await prisma.workpackDocument.create({
            data: {
              id: randomUUID(),
              organization_id: wp.organization_id,
              site_id: wp.site_id,
              workpack_id: workpackId,
              original_filename: `p_and_id_${pid}`,
              storage_path: `ref://p_and_id/${pid}`,
              document_type: 'p_and_id',
              title: `P&ID: ${pid}`,
              description: 'P&ID reference from asset register',
              source: 'document_intelligence',
              created_by: userId,
              updated_at: new Date(),
            },
          });
          details.push({ name: `P&ID: ${pid}`, type: 'p_and_id', source: 'asset_register' });
        }
      }
    }

    // 3. GA Drawing from asset
    if (wp.asset?.ga_drawing_number) {
      const exists = await prisma.workpackDocument.findFirst({
        where: { workpack_id: workpackId, document_type: 'ga_drawing', deleted_at: null },
      });
      if (!exists) {
        await prisma.workpackDocument.create({
          data: {
            id: randomUUID(),
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            workpack_id: workpackId,
            original_filename: `ga_drawing_${wp.asset.ga_drawing_number}`,
            storage_path: `ref://ga_drawing/${wp.asset.ga_drawing_number}`,
            document_type: 'ga_drawing',
            title: `GA Drawing: ${wp.asset.ga_drawing_number}`,
            source: 'document_intelligence',
            created_by: userId,
            updated_at: new Date(),
          },
        });
        details.push({ name: `GA Drawing: ${wp.asset.ga_drawing_number}`, type: 'ga_drawing', source: 'asset_register' });
      }
    }

    // 4. Previous workpacks on same asset
    const prevWps = await prisma.workpack.findMany({
      where: {
        organization_id: wp.organization_id,
        asset_id: wp.asset_id,
        id: { not: workpackId },
        deleted_at: null,
      },
      select: { id: true, workpack_number: true, title: true },
      take: 10,
      orderBy: { created_at: 'desc' },
    });
    for (const prev of prevWps) {
      const exists = await prisma.workpackDocument.findFirst({
        where: { workpack_id: workpackId, storage_path: `ref://workpack/${prev.id}`, deleted_at: null },
      });
      if (!exists) {
        await prisma.workpackDocument.create({
          data: {
            id: randomUUID(),
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            workpack_id: workpackId,
            original_filename: `previous_wp_${prev.workpack_number || prev.id}`,
            storage_path: `ref://workpack/${prev.id}`,
            document_type: 'previous_workpack',
            title: `Previous WP: ${prev.workpack_number || ''} - ${prev.title}`,
            description: 'Previous workpack on same asset',
            source: 'document_intelligence',
            created_by: userId,
            updated_at: new Date(),
          },
        });
        details.push({ name: `Previous WP: ${prev.workpack_number}`, type: 'previous_workpack', source: 'history' });
      }
    }

    // 5. Lessons learned
    const lessons = await prisma.lessonLearned.findMany({
      where: {
        organization_id: wp.organization_id,
        workpack: { asset_id: wp.asset_id },
      },
      select: { id: true, title: true },
      take: 10,
    });
    for (const lesson of lessons) {
      const exists = await prisma.workpackDocument.findFirst({
        where: { workpack_id: workpackId, storage_path: `ref://lesson/${lesson.id}`, deleted_at: null },
      });
      if (!exists) {
        await prisma.workpackDocument.create({
          data: {
            id: randomUUID(),
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            workpack_id: workpackId,
            original_filename: `lesson_${lesson.id}`,
            storage_path: `ref://lesson/${lesson.id}`,
            document_type: 'lesson_learned',
            title: `Lesson: ${lesson.title}`,
            description: 'Lesson learned from previous work on same asset',
            source: 'document_intelligence',
            created_by: userId,
            updated_at: new Date(),
          },
        });
        details.push({ name: `Lesson: ${lesson.title}`, type: 'lesson_learned', source: 'knowledge_base' });
      }
    }

    return { attached: details.length, details };
  }

  /** Identify expected but missing document types */
  static async identifyMissing(workpackId: string): Promise<{
    missing: Array<{ type: string; label: string; suggestion: string }>;
    coverage: number;
  }> {
    const docs = await prisma.workpackDocument.findMany({
      where: { workpack_id: workpackId, deleted_at: null },
      select: { document_type: true },
    });
    const presentTypes = new Set(docs.map(d => d.document_type));

    const LABELS: Record<string, string> = {
      p_and_id: 'P&ID Drawing',
      oem_manual: 'OEM Manual',
      datasheet: 'Equipment Datasheet',
      inspection_report: 'Inspection Report',
      vendor_manual: 'Vendor Manual',
      photograph: 'Photographs',
      lesson_learned: 'Lessons Learned',
      maintenance_history: 'Maintenance History',
      previous_workpack: 'Previous Workpack',
      ga_drawing: 'GA Drawing',
      isometric: 'Isometric Drawing',
    };

    const missing = EXPECTED_DOC_TYPES
      .filter(t => !presentTypes.has(t))
      .map(t => ({
        type: t,
        label: LABELS[t] || t,
        suggestion: `Attach ${LABELS[t] || t} to improve readiness`,
      }));

    const coverage = EXPECTED_DOC_TYPES.length > 0
      ? Math.round(((EXPECTED_DOC_TYPES.length - missing.length) / EXPECTED_DOC_TYPES.length) * 100)
      : 100;

    return { missing, coverage };
  }
}
