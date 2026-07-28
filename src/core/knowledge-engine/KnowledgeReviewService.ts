import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

async function resolvePlatformOrganizationId(): Promise<string | null> {
  const org = await prisma.organization.findFirst({
    where: {
      deleted_at: null,
      OR: [{ slug: 'syority-platform' }, { tenant_type: 'platform' }],
    },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  });
  return org?.id ?? null;
}

type Decision = 'APPROVE' | 'MERGE' | 'REJECT' | 'REQUEST_REVISION';

/**
 * Platform reviewer actions. Promote approved assets into Platform Standard Library.
 */
export class KnowledgeReviewService {
  static async decide(params: {
    assetId: string;
    decision: Decision;
    notes?: string;
    reviewerId?: string;
    mergeTargetId?: string;
  }) {
    const asset = await prisma.knowledgeAsset.findUnique({ where: { id: params.assetId } });
    if (!asset) throw new Error('Knowledge asset not found');
    if (asset.status !== 'REVIEW_QUEUE' && asset.status !== 'AI_ANALYSIS') {
      throw new Error(`Asset is not reviewable (status=${asset.status})`);
    }

    await prisma.knowledgeReviewLog.create({
      data: {
        asset_id: params.assetId,
        decision: params.decision,
        notes: params.notes ?? null,
        reviewed_by: params.reviewerId ?? null,
      },
    });

    if (params.decision === 'REJECT') {
      return prisma.knowledgeAsset.update({
        where: { id: params.assetId },
        data: {
          status: 'REJECTED',
          reviewer_notes: params.notes ?? null,
          reviewed_by: params.reviewerId ?? null,
          reviewed_at: new Date(),
        },
      });
    }

    if (params.decision === 'REQUEST_REVISION') {
      return prisma.knowledgeAsset.update({
        where: { id: params.assetId },
        data: {
          status: 'REVIEW_QUEUE',
          reviewer_notes: params.notes ?? 'Revision requested (internal)',
          reviewed_by: params.reviewerId ?? null,
          reviewed_at: new Date(),
          ai_suggestion: params.notes
            ? `Revision requested: ${params.notes}`
            : asset.ai_suggestion,
        },
      });
    }

    if (params.decision === 'MERGE') {
      const targetId = params.mergeTargetId || asset.matched_asset_id;
      if (!targetId) throw new Error('Merge target required');
      const target = await prisma.knowledgeAsset.findUnique({ where: { id: targetId } });
      if (!target || target.status !== 'APPROVED') {
        throw new Error('Merge target must be an Approved Library asset');
      }

      const mergedTitles = [
        ...((((target.sanitized_payload as any)?._merged_from_titles as string[]) || []) as string[]),
        asset.title,
      ];

      await prisma.knowledgeAsset.update({
        where: { id: targetId },
        data: {
          last_seen_at: new Date(),
          times_seen: { increment: asset.times_seen },
          times_used: { increment: asset.times_used },
          sanitized_payload: {
            ...(target.sanitized_payload as object),
            ...(asset.sanitized_payload as object),
            _merged_from_titles: mergedTitles,
          } as any,
        },
      });

      return prisma.knowledgeAsset.update({
        where: { id: params.assetId },
        data: {
          status: 'APPROVED',
          matched_asset_id: targetId,
          ai_recommendation: 'MERGE',
          reviewer_notes: params.notes ?? `Merged into ${target.title}`,
          reviewed_by: params.reviewerId ?? null,
          reviewed_at: new Date(),
          promoted_at: new Date(),
        },
      });
    }

    const promoted = await prisma.knowledgeAsset.update({
      where: { id: params.assetId },
      data: {
        status: 'APPROVED',
        reviewer_notes: params.notes ?? null,
        reviewed_by: params.reviewerId ?? null,
        reviewed_at: new Date(),
        promoted_at: new Date(),
      },
    });

    await promoteToPlatformLibrary(promoted, params.reviewerId).catch((err) => {
      console.error('[KnowledgeEngine] Promote to platform tables failed:', err);
    });

    // Part 11: Audit log for all decisions
    void AuditService.log({
      organization_id: 'platform',
      user_id: params.reviewerId || 'system',
      action: `knowledge_${params.decision.toLowerCase()}`,
      model_name: 'KnowledgeAsset',
      model_id: params.assetId,
      new_values: { decision: params.decision, category: promoted.category },
    });

    return promoted;
  }

  static async list(status?: string, category?: string) {
    return prisma.knowledgeAsset.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(category ? { category: category as any } : {}),
      },
      orderBy: [{ status: 'asc' }, { last_seen_at: 'desc' }],
      take: 200,
      include: {
        matched_asset: { select: { id: true, title: true, status: true } },
        reviews: { orderBy: { created_at: 'desc' }, take: 5 },
      },
    });
  }

  static async get(id: string) {
    return prisma.knowledgeAsset.findUnique({
      where: { id },
      include: {
        matched_asset: true,
        reviews: { orderBy: { created_at: 'desc' } },
      },
    });
  }

  static async stats() {
    const groups = await prisma.knowledgeAsset.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const map: Record<string, number> = {};
    for (const g of groups) map[g.status] = g._count._all;
    return map;
  }
}

async function promoteToPlatformLibrary(asset: {
  id: string;
  category: string;
  title: string;
  sanitized_payload: unknown;
  asset_type: string;
}, reviewerId?: string | null) {
  const platformOrgId = await resolvePlatformOrganizationId();
  if (!platformOrgId) return;

  const p = (asset.sanitized_payload || {}) as Record<string, any>;
  const now = new Date();

  switch (asset.category) {
    case 'ACTIVITY_CODE': {
      const name = String(p.name || asset.title);
      const existing = await prisma.activityLibrary.findFirst({
        where: { organization_id: platformOrgId, name, deleted_at: null },
      });
      if (!existing) {
        await prisma.activityLibrary.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrgId,
            name,
            description: p.description ?? null,
            duration_hours: Number(p.duration_hours) || 0,
            is_active: true,
            activity_code: p.activity_code || `KE-${asset.id.slice(0, 8).toUpperCase()}`,
            hold_point_type: p.hold_point_type ?? null,
            work_category: p.work_category ?? null,
            phase: p.phase ?? null,
            level_code: p.level_code ?? null,
            updated_at: now,
          },
        });
      }
      break;
    }
    case 'EQUIPMENT_TYPE': {
      const name = String(p.name || asset.title);
      const existing = await prisma.equipmentType.findFirst({
        where: { org_id: platformOrgId, name },
      });
      if (!existing) {
        await prisma.equipmentType.create({
          data: {
            id: randomUUID(),
            org_id: platformOrgId,
            name,
            code: p.code ?? null,
            description: p.description ?? null,
            is_active: true,
          },
        });
      }
      break;
    }
    case 'RESOURCE_TYPE': {
      const name = String(p.name || asset.title);
      const existing = await prisma.resourceType.findFirst({
        where: { organization_id: platformOrgId, name },
      });
      if (!existing) {
        await prisma.resourceType.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrgId,
            name,
            code: p.code ?? `KE-${asset.id.slice(0, 6)}`,
            is_active: true,
            updated_at: now,
          },
        });
      }
      break;
    }
    case 'UDF_DEFINITION': {
      const code = String(p.code || p.field_key || asset.title)
        .toUpperCase()
        .replace(/\s+/g, '_')
        .slice(0, 64);
      const existing = await prisma.activityUdfDefinition.findFirst({
        where: { organization_id: platformOrgId, code, deleted_at: null },
      });
      if (!existing) {
        await prisma.activityUdfDefinition.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrgId,
            name: String(p.name || p.label || asset.title),
            code,
            type: String(p.type || p.data_type || 'TEXT'),
            is_mandatory: Boolean(p.is_mandatory ?? p.is_required),
            is_active: true,
            updated_at: now,
          },
        });
      }
      break;
    }
    case 'WORKPACK_TEMPLATE': {
      // Part 2: Full promotion — create Platform Standard Template from knowledge asset
      const templateName = String(p.name || asset.title);

      // Check for existing platform template with same name to avoid duplicates
      const existingTpl = await prisma.workpack_templates.findFirst({
        where: {
          organization_id: platformOrgId,
          library_scope: 'PLATFORM',
          name: templateName,
          deleted_at: null,
        },
      });
      if (existingTpl) break; // Already promoted

      const tplId = randomUUID();
      const createdBy = reviewerId || 'system';

      // Part 6: Platform standard metadata
      const platformMetadata = {
        standard_owner: 'Platform',
        standard_category: p.category || 'General',
        industry: p.industry || null,
        maintenance_category: p.maintenance_category || null,
        knowledge_source: 'KNOWLEDGE_PROMOTED',
        confidence_score: p.similarity_score || null,
        last_reviewed: now.toISOString(),
        review_frequency: 'QUARTERLY',
      };

      await prisma.workpack_templates.create({
        data: {
          id: tplId,
          organization_id: platformOrgId,
          template_family_id: tplId,
          revision: 1,
          version_label: '1.0',
          library_scope: 'PLATFORM',
          lifecycle_status: 'PUBLISHED',
          name: templateName,
          category: p.category ?? null,
          equipment_type: p.equipment_type || 'General',
          equipment_class: p.equipment_class ?? null,
          job_type: p.job_type || 'General',
          discipline_id: p.discipline_id ?? null,
          description: p.description ?? null,
          planning_json: p.planning_json ?? {},
          resources_json: p.resources_json ?? [],
          materials_json: p.materials_json ?? [],
          safety_json: p.safety_json ?? {},
          qaqc_json: p.qaqc_json ?? {},
          references_json: p.references_json ?? [],
          ai_metadata_json: { ...((p.ai_metadata_json as object) || {}), platform_metadata: platformMetadata },
          is_system: true,
          is_active: true,
          created_by: createdBy,
          published_at: now,
          // Part 3: Bidirectional traceability
          knowledge_asset_id: asset.id,
          updated_at: now,
        },
      });

      // Copy activities from sanitized payload
      const activities = Array.isArray(p.activities) ? p.activities : [];
      let seq = 1;
      for (const a of activities) {
        await prisma.workpack_template_activities.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrgId,
            template_id: tplId,
            sequence_number: a.sequence_number ?? seq++,
            activity_code: a.activity_code ?? null,
            description: a.description || 'Activity',
            duration_hours: a.duration_hours ?? null,
            is_optional: a.is_optional ?? false,
            hold_point_type: a.hold_point_type ?? null,
            hold_point_description: a.hold_point_description ?? null,
            predecessor_sequences: a.predecessor_sequences ?? [],
            updated_at: now,
          },
        });
      }

      // Copy logic links from sanitized payload
      const logicLinks = Array.isArray(p.logic_links) ? p.logic_links : [];
      for (const l of logicLinks) {
        await prisma.workpack_template_logic_links.create({
          data: {
            id: randomUUID(),
            organization_id: platformOrgId,
            template_id: tplId,
            predecessor_seq: l.predecessor_seq,
            successor_seq: l.successor_seq,
            link_type: l.link_type || 'FS',
            lag_hours: l.lag_hours ?? 0,
            updated_at: now,
          },
        });
      }

      // Part 11: Audit log for promotion
      void AuditService.log({
        organization_id: platformOrgId,
        user_id: createdBy,
        action: 'knowledge_promoted',
        model_name: 'WorkpackTemplate',
        model_id: tplId,
        new_values: {
          knowledge_asset_id: asset.id,
          name: templateName,
          library_scope: 'PLATFORM',
          activities_count: activities.length,
          logic_links_count: logicLinks.length,
        },
      });
      break;
    }
    case 'CERTIFICATE_TEMPLATE':
    case 'PRINT_SETTINGS':
    case 'QA_QC_TEMPLATE':
    case 'SAFETY_TEMPLATE':
      // Canonical Approved Library entry is knowledge_assets; table shapes vary / need created_by.
      break;
    default:
      break;
  }
}
