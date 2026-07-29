import { prisma } from '@/lib/prisma';

/**
 * Workpack AI Service — advisory only (ADR-0012).
 *
 * AI MAY: recommend template, identify missing data,
 *         highlight lessons, similar workpacks, previous delays.
 * AI SHALL NEVER: generate activities, modify templates, modify scope.
 * AI SHALL NEVER: recommend Maintenance Strategies (deferred to Asset Integrity).
 */
export class WorkpackAiService {
  /** Recommend a template based on asset type + scope item details */
  static async recommendTemplate(orgId: string, opts: {
    assetType?: string;
    equipmentType?: string;
    discipline?: string;
    reason?: string;
  }): Promise<{
    recommendations: Array<{
      templateId: string;
      templateName: string;
      matchReason: string;
      confidence: number;
    }>;
  }> {
    const where: any = {
      deleted_at: null,
      lifecycle_status: 'PUBLISHED',
      OR: [
        { organization_id: orgId },
        { library_scope: 'PLATFORM' },
        { library_scope: 'KNOWLEDGE' },
      ],
    };

    // Match by equipment type
    if (opts.equipmentType || opts.assetType) {
      where.equipment_type = {
        contains: opts.equipmentType || opts.assetType || '',
        mode: 'insensitive',
      };
    }

    const templates = await prisma.workpack_templates.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 10,
    });

    const recommendations = templates.map(t => {
      let confidence = 0.5;
      let matchReason = 'Equipment type match';

      if (opts.equipmentType && t.equipment_type.toLowerCase().includes(opts.equipmentType.toLowerCase())) {
        confidence += 0.2;
      }
      if (opts.discipline && t.discipline_id) {
        confidence += 0.1;
        matchReason += ', discipline match';
      }
      if (t.library_scope === 'PLATFORM') {
        confidence += 0.1;
        matchReason += ', platform standard';
      }

      return {
        templateId: t.id,
        templateName: t.name,
        matchReason,
        confidence: Math.min(confidence, 1.0),
      };
    });

    recommendations.sort((a, b) => b.confidence - a.confidence);
    return { recommendations: recommendations.slice(0, 5) };
  }

  /** Find similar past workpacks */
  static async findSimilarWorkpacks(orgId: string, opts: {
    assetType?: string;
    equipmentType?: string;
    templateId?: string;
  }): Promise<Array<{
    workpackId: string;
    workpackNumber: string | null;
    title: string;
    assetTag: string | null;
    status: string;
    readinessScore: number | null;
    createdAt: Date;
  }>> {
    const where: any = {
      organization_id: orgId,
      deleted_at: null,
    };

    if (opts.templateId) where.template_id = opts.templateId;
    if (opts.equipmentType) where.equipment_type = { contains: opts.equipmentType, mode: 'insensitive' };

    const workpacks = await prisma.workpack.findMany({
      where,
      select: {
        id: true, workpack_number: true, title: true, status: true,
        readiness_score: true, created_at: true,
        asset: { select: { tag_number: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return workpacks.map(wp => ({
      workpackId: wp.id,
      workpackNumber: wp.workpack_number,
      title: wp.title,
      assetTag: wp.asset?.tag_number || null,
      status: wp.status,
      readinessScore: wp.readiness_score,
      createdAt: wp.created_at,
    }));
  }

  /** Identify missing data for a workpack */
  static async identifyMissingData(workpackId: string): Promise<{
    missing: Array<{ field: string; label: string; severity: string }>;
  }> {
    const wp = await prisma.workpack.findUnique({
      where: { id: workpackId },
      include: {
        activities: { where: { deleted_at: null }, select: { id: true } },
        workpack_documents: { where: { deleted_at: null }, select: { id: true } },
        workpack_materials: { where: { deleted_at: null }, select: { id: true } },
        certificateInstances: { select: { id: true } },
        blinds: { where: { deleted_at: null }, select: { id: true } },
      },
    });
    if (!wp) throw new Error('Workpack not found');

    const resourceCount = await prisma.activityResource.count({ where: { workpack_id: workpackId } });

    const missing: Array<{ field: string; label: string; severity: string }> = [];

    if (!wp.template_id) missing.push({ field: 'template', label: 'No template selected', severity: 'high' });
    if (wp.activities.length === 0) missing.push({ field: 'activities', label: 'No activities generated', severity: 'critical' });
    if (wp.workpack_documents.length === 0) missing.push({ field: 'documents', label: 'No documents attached', severity: 'medium' });
    if (resourceCount === 0) missing.push({ field: 'resources', label: 'No resources assigned', severity: 'high' });
    if (wp.workpack_materials.length === 0) missing.push({ field: 'materials', label: 'No materials defined', severity: 'medium' });
    if (wp.certificateInstances.length === 0) missing.push({ field: 'certificates', label: 'No certificates attached', severity: 'high' });
    if (wp.blinds.length === 0) missing.push({ field: 'isolation', label: 'No isolation/blind plan', severity: 'medium' });
    if (!wp.planned_start_date) missing.push({ field: 'start_date', label: 'No planned start date', severity: 'medium' });
    if (!wp.planned_end_date) missing.push({ field: 'end_date', label: 'No planned end date', severity: 'medium' });
    if (wp.approval_status !== 'approved') missing.push({ field: 'approval', label: 'Not yet approved', severity: 'low' });

    return { missing };
  }
}
