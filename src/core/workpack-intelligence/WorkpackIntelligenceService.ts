import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';
import { AuditService } from '@/lib/audit';

/**
 * Workpack Intelligence Engine — transforms approved Scope Items into executable Workpacks.
 *
 * CORE PRINCIPLE: AI NEVER creates activities. Only approved Company Libraries generate workpack content.
 */
export class WorkpackIntelligenceService {
  /**
   * MAIN ENTRY POINT — Create a workpack from an approved Scope Item.
   *
   * Flow (ADR-0012 — Workpack Templates are the only reusable execution object):
   * 1. Validate scope item (must be from approved/frozen scope)
   * 2. Validate template (must be PUBLISHED)
   * 3. Instantiate via TemplateLibraryService (creates workpack + activities)
   * 4. Materialize resources from template resources_json
   * 5. Materialize materials from template materials_json
   * 6. Materialize certificates from template qaqc_json
   * 7. Auto-attach documents from asset
   * 8. Create WorkpackInstantiation traceability record
   * 9. Compute readiness + compliance scores
   * 10. Link ScopeItem.workpack_id
   */
  static async instantiateFromScope(opts: {
    organizationId: string;
    siteId: string;
    scopeItemId: string;
    templateId: string;
    userId: string;
    title?: string;
    plannedStartDate?: Date;
    plannedEndDate?: Date;
    contractorId?: string;
  }) {
    // ── 1. Validate scope item ──────────────────────────────────────────────
    const scopeItem = await prisma.scopeItem.findFirst({
      where: { id: opts.scopeItemId, organization_id: opts.organizationId, deleted_at: null },
      include: {
        scope: { select: { id: true, status: true, event_id: true, name: true } },
        asset: { select: { id: true, tag_number: true, name: true, asset_type: true, plant_id: true, unit_id: true, system_id: true } },
      },
    });
    if (!scopeItem) throw new Error('Scope item not found');
    if (!['approved', 'frozen'].includes(scopeItem.scope.status)) {
      throw new Error(`Scope must be approved or frozen (current: ${scopeItem.scope.status})`);
    }
    if (scopeItem.workpack_id) {
      throw new Error('This scope item already has a workpack');
    }

    // ── 2. Validate template (must be PUBLISHED — ADR-0012) ─────────────────
    const template = await TemplateLibraryService.get(opts.templateId, opts.organizationId);
    if (!template) throw new Error('Template not found');
    if (template.lifecycle_status !== 'PUBLISHED') {
      throw new Error('Only PUBLISHED templates can be instantiated');
    }

    // ── 3. Instantiate workpack + activities via existing service ────────────
    const result = await TemplateLibraryService.instantiate({
      templateId: opts.templateId,
      organizationId: opts.organizationId,
      siteId: opts.siteId,
      userId: opts.userId,
      title: opts.title || `${scopeItem.asset.tag_number} - ${template.name}`,
      event_id: scopeItem.scope.event_id,
      asset_id: scopeItem.asset_id,
      unit_id: scopeItem.unit_id || undefined,
      discipline_id: template.discipline_id || undefined,
      contractor_id: opts.contractorId,
      planned_start_date: opts.plannedStartDate,
      planned_end_date: opts.plannedEndDate,
    });

    const workpackId = result.workpack_id;

    // ── 4. Set M7.4 fields on workpack ──────────────────────────────────────
    await prisma.workpack.update({
      where: { id: workpackId },
      data: {
        scope_item_id: opts.scopeItemId,
        plant_id: scopeItem.asset.plant_id,
        system_id: scopeItem.asset.system_id,
        priority: scopeItem.priority === 'critical' ? 'Critical' :
                  scopeItem.priority === 'high' ? 'High' :
                  scopeItem.priority === 'medium' ? 'Normal' : 'Low',
      },
    });

    // ── 6. Materialize resources from template ──────────────────────────────
    let resourcesCreated = 0;
    const resourcesJson = template.resources_json as any[];
    if (Array.isArray(resourcesJson)) {
      const activities = await prisma.activity.findMany({
        where: { workpack_id: workpackId, deleted_at: null },
        orderBy: { sequence_number: 'asc' },
      });
      const firstActivityId = activities[0]?.id;

      for (const r of resourcesJson) {
        if (!r.name && !r.resource_name) continue;
        await prisma.activityResource.create({
          data: {
            id: randomUUID(),
            organization_id: opts.organizationId,
            workpack_id: workpackId,
            activity_id: firstActivityId || randomUUID(),
            resource_name: r.name || r.resource_name,
            resource_type: r.type || r.resource_type || 'labor',
            headcount: r.headcount || r.crew_size || 1,
            crew_size: r.crew_size || r.headcount || 1,
            planned_hours: r.planned_hours || r.hours || 0,
            notes: r.notes,
            updated_at: new Date(),
          },
        });
        resourcesCreated++;
      }
    }

    // ── 7. Materialize materials from template ──────────────────────────────
    let materialsCreated = 0;
    const materialsJson = template.materials_json as any[];
    if (Array.isArray(materialsJson)) {
      for (const m of materialsJson) {
        if (!m.description) continue;
        await prisma.workpackMaterial.create({
          data: {
            id: randomUUID(),
            organization_id: opts.organizationId,
            site_id: opts.siteId,
            workpack_id: workpackId,
            description: m.description,
            unit_of_measure: m.unit || m.unit_of_measure || 'EA',
            quantity_required: m.quantity || m.quantity_required || 0,
            material_number: m.material_number || m.part_number,
            material_category: m.category || m.material_category || 'mechanical',
            specifications: m.specifications || m.spec,
            is_critical: m.is_critical || false,
            notes: m.notes,
            ai_generated: false,
            created_by: opts.userId,
            updated_at: new Date(),
          },
        });
        materialsCreated++;
      }
    }

    // ── 8. Materialize certificates from template qaqc ──────────────────────
    let certificatesCreated = 0;
    const qaqcJson = template.qaqc_json as any;
    const certTypes: string[] = qaqcJson?.certificate_types || qaqcJson?.certificates || [];
    if (Array.isArray(certTypes) && certTypes.length > 0) {
      // Look up matching certificate templates for these types
      const certTemplates = await prisma.certificate_templates.findMany({
        where: {
          OR: [
            { organization_id: opts.organizationId },
            { is_platform: true },
          ],
          is_active: true,
          cert_type: { in: certTypes },
        },
      });

      for (const ct of certTemplates) {
        await prisma.certificateInstance.create({
          data: {
            id: randomUUID(),
            organization_id: opts.organizationId,
            workpack_id: workpackId,
            template_id: ct.id,
            cert_type: ct.cert_type,
            cert_name: ct.cert_name,
            status: 'not_started',
            field_values: {},
            updated_at: new Date(),
          },
        });
        certificatesCreated++;
      }
    }

    // ── 9. Auto-attach asset documents ──────────────────────────────────────
    let documentsAttached = 0;
    const assetDocLinks = await prisma.assetDocumentLink.findMany({
      where: { asset_id: scopeItem.asset_id },
      include: { document: { select: { title: true, document_type: true, original_filename: true, storage_path: true } } },
      take: 50,
    });
    for (const link of assetDocLinks) {
      await prisma.workpackDocument.create({
        data: {
          id: randomUUID(),
          organization_id: opts.organizationId,
          site_id: opts.siteId,
          workpack_id: workpackId,
          original_filename: link.document?.original_filename || 'auto_attached_document',
          storage_path: link.document?.storage_path || 'auto_attached',
          document_type: link.link_type || link.document?.document_type || 'reference',
          title: link.document?.title || 'Asset Document',
          description: `Auto-attached from asset ${scopeItem.asset.tag_number}`,
          source: 'auto_attached',
          source_document_id: link.document_id,
          created_by: opts.userId,
          updated_at: new Date(),
        },
      });
      documentsAttached++;
    }

    // Previous workpacks on same asset
    const previousWorkpacks = await prisma.workpack.findMany({
      where: {
        organization_id: opts.organizationId,
        asset_id: scopeItem.asset_id,
        id: { not: workpackId },
        deleted_at: null,
      },
      select: { id: true, workpack_number: true, title: true },
      take: 10,
      orderBy: { created_at: 'desc' },
    });
    for (const pw of previousWorkpacks) {
      await prisma.workpackDocument.create({
        data: {
          id: randomUUID(),
          organization_id: opts.organizationId,
          site_id: opts.siteId,
          workpack_id: workpackId,
          original_filename: `previous_wp_${pw.workpack_number || pw.id}`,
          storage_path: `ref://workpack/${pw.id}`,
          document_type: 'previous_workpack',
          title: `Previous WP: ${pw.workpack_number || ''} - ${pw.title}`,
          description: 'Previous workpack on same asset',
          source: 'auto_attached',
          created_by: opts.userId,
          updated_at: new Date(),
        },
      });
      documentsAttached++;
    }

    // Lessons learned on same asset
    const lessons = await prisma.lessonLearned.findMany({
      where: {
        organization_id: opts.organizationId,
        workpack: { asset_id: scopeItem.asset_id },
      },
      select: { id: true, title: true },
      take: 10,
    });
    for (const lesson of lessons) {
      await prisma.workpackDocument.create({
        data: {
          id: randomUUID(),
          organization_id: opts.organizationId,
          site_id: opts.siteId,
          workpack_id: workpackId,
          original_filename: `lesson_${lesson.id}`,
          storage_path: `ref://lesson/${lesson.id}`,
          document_type: 'lesson_learned',
          title: `Lesson: ${lesson.title}`,
          description: 'Lesson learned from previous work on same asset',
          source: 'auto_attached',
          created_by: opts.userId,
          updated_at: new Date(),
        },
      });
      documentsAttached++;
    }

    // ── 10. Create WorkpackInstantiation traceability record ─────────────────
    const activities = await prisma.activity.findMany({
      where: { workpack_id: workpackId, deleted_at: null },
    });

    const instantiation = await prisma.workpackInstantiation.create({
      data: {
        id: randomUUID(),
        organization_id: opts.organizationId,
        workpack_id: workpackId,
        scope_item_id: opts.scopeItemId,
        scope_id: scopeItem.scope_id,
        template_id: opts.templateId,
        template_revision: template.revision,
        template_family_id: template.template_family_id,
        asset_id: scopeItem.asset_id,
        event_id: scopeItem.scope.event_id,
        activities_created: activities.length,
        resources_created: resourcesCreated,
        materials_created: materialsCreated,
        certificates_created: certificatesCreated,
        documents_attached: documentsAttached,
        instantiated_by: opts.userId,
      },
    });

    // ── 11. Link ScopeItem.workpack_id ──────────────────────────────────────
    await prisma.scopeItem.update({
      where: { id: opts.scopeItemId },
      data: { workpack_id: workpackId, updated_by: opts.userId },
    });

    // ── 12. Compute readiness + compliance ──────────────────────────────────
    const { ReadinessScoreService } = await import('./ReadinessScoreService');
    const { ComplianceScoreService } = await import('./ComplianceScoreService');
    const [readiness, compliance] = await Promise.all([
      ReadinessScoreService.computeReadiness(workpackId),
      ComplianceScoreService.computeCompliance(workpackId),
    ]);

    await prisma.workpack.update({
      where: { id: workpackId },
      data: {
        readiness_score: readiness.score,
        compliance_score: compliance.score,
      },
    });

    await prisma.workpackInstantiation.update({
      where: { id: instantiation.id },
      data: {
        readiness_score: readiness.score,
        compliance_score: compliance.score,
        readiness_detail: readiness.detail as any,
        compliance_detail: compliance as any,
      },
    });

    // ── 13. Audit ───────────────────────────────────────────────────────────
    void AuditService.log({
      organization_id: opts.organizationId,
      user_id: opts.userId,
      action: 'workpack_instantiated',
      model_name: 'WorkpackIntelligence',
      model_id: workpackId,
      new_values: {
        scope_item_id: opts.scopeItemId,
        template_id: opts.templateId,
        template_revision: template.revision,
        activities: activities.length,
        resources: resourcesCreated,
        materials: materialsCreated,
        certificates: certificatesCreated,
        documents: documentsAttached,
        readiness_score: readiness.score,
        compliance_score: compliance.score,
      },
    });

    return {
      workpack_id: workpackId,
      template_id: opts.templateId,
      template_revision: template.revision,
      scope_item_id: opts.scopeItemId,
      instantiation_id: instantiation.id,
      counts: {
        activities: activities.length,
        resources: resourcesCreated,
        materials: materialsCreated,
        certificates: certificatesCreated,
        documents: documentsAttached,
      },
      readiness_score: readiness.score,
      compliance_score: compliance.score,
    };
  }

  /** Bulk instantiate multiple scope items */
  static async bulkInstantiate(opts: {
    organizationId: string;
    siteId: string;
    items: Array<{
      scopeItemId: string;
      templateId: string;
      title?: string;
    }>;
    userId: string;
  }) {
    const results: any[] = [];
    const errors: any[] = [];

    for (const item of opts.items) {
      try {
        const result = await this.instantiateFromScope({
          organizationId: opts.organizationId,
          siteId: opts.siteId,
          scopeItemId: item.scopeItemId,
          templateId: item.templateId,
          title: item.title,
          userId: opts.userId,
        });
        results.push(result);
      } catch (err: any) {
        errors.push({
          scopeItemId: item.scopeItemId,
          error: err.message,
        });
      }
    }

    return { created: results.length, failed: errors.length, results, errors };
  }

  /** Get intelligence dashboard for a scope */
  static async getDashboard(orgId: string, scopeId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, status: true, total_items: true },
    });
    if (!scope) throw new Error('Scope not found');

    const [totalItems, itemsWithWorkpack, workpacks] = await Promise.all([
      prisma.scopeItem.count({ where: { scope_id: scopeId, deleted_at: null } }),
      prisma.scopeItem.count({ where: { scope_id: scopeId, deleted_at: null, workpack_id: { not: null } } }),
      prisma.workpack.findMany({
        where: {
          scope_item_id: { not: null },
          organization_id: orgId,
          deleted_at: null,
          instantiation: { scope_id: scopeId },
        },
        select: {
          id: true, title: true, workpack_number: true, status: true,
          readiness_score: true, compliance_score: true, work_type: true,
          asset: { select: { tag_number: true, name: true } },
          instantiation: {
            select: {
              activities_created: true, resources_created: true,
              materials_created: true, certificates_created: true,
              documents_attached: true,
            },
          },
        },
      }),
    ]);

    // Aggregate by status
    const byStatus: Record<string, number> = {};
    let totalReadiness = 0;
    let totalCompliance = 0;

    for (const wp of workpacks) {
      byStatus[wp.status] = (byStatus[wp.status] || 0) + 1;
      totalReadiness += wp.readiness_score || 0;
      totalCompliance += wp.compliance_score || 0;
    }

    return {
      scope,
      summary: {
        total_scope_items: totalItems,
        items_with_workpack: itemsWithWorkpack,
        items_pending: totalItems - itemsWithWorkpack,
        total_workpacks: workpacks.length,
        avg_readiness: workpacks.length > 0 ? Math.round(totalReadiness / workpacks.length) : 0,
        avg_compliance: workpacks.length > 0 ? Math.round(totalCompliance / workpacks.length) : 0,
        by_status: byStatus,
      },
      workpacks,
    };
  }
}
