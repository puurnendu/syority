import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { TemplateLibraryScope, TemplateLifecycleStatus } from '@prisma/client';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';
import { AuditService } from '@/lib/audit';

export type TemplateSectionPayload = {
  planning_json?: unknown;
  resources_json?: unknown;
  materials_json?: unknown;
  safety_json?: unknown;
  qaqc_json?: unknown;
  references_json?: unknown;
  ai_metadata_json?: unknown;
  activities?: Array<{
    sequence_number?: number;
    activity_code?: string;
    description: string;
    duration_hours?: number;
    is_optional?: boolean;
    hold_point_type?: string;
    hold_point_description?: string;
    predecessor_sequences?: number[];
  }>;
  logic_links?: Array<{
    predecessor_seq: number;
    successor_seq: number;
    link_type?: string;
    lag_hours?: number;
  }>;
};

/**
 * Enterprise Workpack Template Library (Platform / Tenant / Knowledge).
 * Published revisions are immutable; edits create a new revision.
 */
export class TemplateLibraryService {
  static async list(opts: {
    organizationId: string;
    library?: TemplateLibraryScope | 'ALL';
    status?: TemplateLifecycleStatus | 'ALL';
    q?: string;
    latestOnly?: boolean;
  }) {
    const where: any = {
      deleted_at: null,
      OR: [
        { library_scope: 'PLATFORM', lifecycle_status: { in: ['PUBLISHED', 'DEPRECATED'] } },
        { library_scope: 'KNOWLEDGE', lifecycle_status: { in: ['PUBLISHED', 'DEPRECATED'] } },
        { organization_id: opts.organizationId },
      ],
    };
    if (opts.library && opts.library !== 'ALL') {
      where.library_scope = opts.library;
      if (opts.library === 'TENANT') {
        where.OR = undefined;
        where.organization_id = opts.organizationId;
      } else {
        where.OR = undefined;
      }
    }
    if (opts.status && opts.status !== 'ALL') where.lifecycle_status = opts.status;
    if (opts.q?.trim()) {
      where.AND = [
        {
          OR: [
            { name: { contains: opts.q.trim(), mode: 'insensitive' } },
            { equipment_type: { contains: opts.q.trim(), mode: 'insensitive' } },
            { job_type: { contains: opts.q.trim(), mode: 'insensitive' } },
            { description: { contains: opts.q.trim(), mode: 'insensitive' } },
            { category: { contains: opts.q.trim(), mode: 'insensitive' } },
            { equipment_class: { contains: opts.q.trim(), mode: 'insensitive' } },
          ],
        },
      ];
    }

    const rows = await prisma.workpack_templates.findMany({
      where,
      orderBy: [{ name: 'asc' }, { revision: 'desc' }],
      take: 500,
    });

    if (!opts.latestOnly) return rows;

    // One row per family (highest revision)
    const seen = new Set<string>();
    const latest = [];
    for (const r of rows) {
      if (seen.has(r.template_family_id)) continue;
      seen.add(r.template_family_id);
      latest.push(r);
    }
    return latest;
  }

  static async get(id: string, organizationId: string) {
    const tpl = await prisma.workpack_templates.findFirst({
      where: {
        id,
        deleted_at: null,
        OR: [
          { organization_id: organizationId },
          { library_scope: 'PLATFORM' },
          { library_scope: 'KNOWLEDGE' },
        ],
      },
    });
    if (!tpl) return null;

    const [activities, logic_links, family] = await Promise.all([
      prisma.workpack_template_activities.findMany({
        where: { template_id: id },
        orderBy: { sequence_number: 'asc' },
      }),
      prisma.workpack_template_logic_links.findMany({
        where: { template_id: id },
        orderBy: { predecessor_seq: 'asc' },
      }),
      prisma.workpack_templates.findMany({
        where: { template_family_id: tpl.template_family_id, deleted_at: null },
        orderBy: { revision: 'asc' },
        select: {
          id: true,
          revision: true,
          version_label: true,
          lifecycle_status: true,
          created_at: true,
          published_at: true,
        },
      }),
    ]);

    return { ...tpl, activities, logic_links, family_revisions: family };
  }

  static async createDraft(input: {
    organizationId: string;
    userId: string;
    library_scope?: TemplateLibraryScope;
    name: string;
    equipment_type: string;
    job_type: string;
    category?: string;
    equipment_class?: string;
    discipline_id?: string;
    description?: string;
    sections?: TemplateSectionPayload;
  }) {
    const id = randomUUID();
    const scope = input.library_scope || 'TENANT';
    if (scope === 'PLATFORM' || scope === 'KNOWLEDGE') {
      // Platform templates: org may be platform org or null
    }

    const tpl = await prisma.workpack_templates.create({
      data: {
        id,
        organization_id: scope === 'PLATFORM' ? input.organizationId : input.organizationId,
        template_family_id: id,
        revision: 1,
        version_label: '0.1',
        library_scope: scope,
        lifecycle_status: 'DRAFT',
        name: input.name,
        category: input.category ?? null,
        equipment_type: input.equipment_type,
        equipment_class: input.equipment_class ?? null,
        job_type: input.job_type,
        discipline_id: input.discipline_id ?? null,
        description: input.description ?? null,
        planning_json: (input.sections?.planning_json as any) ?? {},
        resources_json: (input.sections?.resources_json as any) ?? [],
        materials_json: (input.sections?.materials_json as any) ?? [],
        safety_json: (input.sections?.safety_json as any) ?? {},
        qaqc_json: (input.sections?.qaqc_json as any) ?? {},
        references_json: (input.sections?.references_json as any) ?? [],
        ai_metadata_json: (input.sections?.ai_metadata_json as any) ?? {},
        is_system: scope === 'PLATFORM',
        is_active: true,
        created_by: input.userId,
        updated_at: new Date(),
      },
    });

    await this.replaceChildren(id, input.organizationId, input.sections);
    return this.get(id, input.organizationId);
  }

  static async updateDraft(
    id: string,
    organizationId: string,
    userId: string,
    data: Partial<{
      name: string;
      category: string;
      equipment_type: string;
      equipment_class: string;
      job_type: string;
      discipline_id: string | null;
      description: string;
    }> &
      TemplateSectionPayload
  ) {
    const existing = await prisma.workpack_templates.findFirst({
      where: { id, organization_id: organizationId, deleted_at: null },
    });
    if (!existing) throw new Error('Template not found');
    if (existing.lifecycle_status !== 'DRAFT') {
      throw new Error('Only DRAFT templates can be edited in place. Create a new revision from published.');
    }

    await prisma.workpack_templates.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.equipment_type !== undefined && { equipment_type: data.equipment_type }),
        ...(data.equipment_class !== undefined && { equipment_class: data.equipment_class }),
        ...(data.job_type !== undefined && { job_type: data.job_type }),
        ...(data.discipline_id !== undefined && { discipline_id: data.discipline_id }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.planning_json !== undefined && { planning_json: data.planning_json as any }),
        ...(data.resources_json !== undefined && { resources_json: data.resources_json as any }),
        ...(data.materials_json !== undefined && { materials_json: data.materials_json as any }),
        ...(data.safety_json !== undefined && { safety_json: data.safety_json as any }),
        ...(data.qaqc_json !== undefined && { qaqc_json: data.qaqc_json as any }),
        ...(data.references_json !== undefined && { references_json: data.references_json as any }),
        ...(data.ai_metadata_json !== undefined && { ai_metadata_json: data.ai_metadata_json as any }),
        updated_by: userId,
        updated_at: new Date(),
      },
    });

    if (data.activities || data.logic_links) {
      await this.replaceChildren(id, organizationId, data);
    }
    return this.get(id, organizationId);
  }

  static async publish(id: string, organizationId: string, userId: string) {
    const existing = await prisma.workpack_templates.findFirst({
      where: { id, organization_id: organizationId, deleted_at: null },
    });
    if (!existing) throw new Error('Template not found');
    if (existing.lifecycle_status !== 'DRAFT') throw new Error('Only drafts can be published');

    const published = await prisma.workpack_templates.update({
      where: { id },
      data: {
        lifecycle_status: 'PUBLISHED',
        published_at: new Date(),
        is_active: true,
        updated_by: userId,
        updated_at: new Date(),
      },
    });

    // Part 1: Fire-and-forget knowledge capture for tenant templates
    if (published.library_scope === 'TENANT') {
      void enqueueKnowledgeCapture({
        organizationId,
        category: 'WORKPACK_TEMPLATE',
        assetType: 'workpack_templates',
        title: published.name,
        payload: published as unknown as Record<string, unknown>,
      });
    }

    // Part 11: Audit log
    void AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'published',
      model_name: 'WorkpackTemplate',
      model_id: id,
      new_values: { lifecycle_status: 'PUBLISHED', revision: published.revision },
    });

    return published;
  }

  static async deprecate(id: string, organizationId: string, userId: string) {
    const existing = await prisma.workpack_templates.findFirst({
      where: {
        id,
        deleted_at: null,
        OR: [{ organization_id: organizationId }, { library_scope: 'PLATFORM' }],
      },
    });
    if (!existing) throw new Error('Template not found');

    const deprecated = await prisma.workpack_templates.update({
      where: { id },
      data: {
        lifecycle_status: 'DEPRECATED',
        deprecated_at: new Date(),
        is_active: false,
        updated_by: userId,
        updated_at: new Date(),
      },
    });

    // Part 11: Audit log
    void AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'deprecated',
      model_name: 'WorkpackTemplate',
      model_id: id,
      new_values: { lifecycle_status: 'DEPRECATED' },
    });

    return deprecated;
  }

  /** Create next revision draft from a published revision (immutable source). */
  static async createRevision(id: string, organizationId: string, userId: string) {
    const source = await this.get(id, organizationId);
    if (!source) throw new Error('Template not found');
    if (source.lifecycle_status === 'DRAFT') {
      throw new Error('Template is already a draft — edit in place');
    }

    const maxRev = await prisma.workpack_templates.aggregate({
      where: { template_family_id: source.template_family_id },
      _max: { revision: true },
    });
    const nextRev = (maxRev._max.revision || source.revision) + 1;
    const newId = randomUUID();

    await prisma.workpack_templates.create({
      data: {
        id: newId,
        organization_id: source.organization_id || organizationId,
        template_family_id: source.template_family_id,
        revision: nextRev,
        version_label: `${nextRev}.0`,
        library_scope: source.library_scope,
        lifecycle_status: 'DRAFT',
        name: source.name,
        category: source.category,
        equipment_type: source.equipment_type,
        equipment_class: source.equipment_class,
        job_type: source.job_type,
        discipline_id: source.discipline_id,
        description: source.description,
        planning_json: source.planning_json as any,
        resources_json: source.resources_json as any,
        materials_json: source.materials_json as any,
        safety_json: source.safety_json as any,
        qaqc_json: source.qaqc_json as any,
        references_json: source.references_json as any,
        ai_metadata_json: source.ai_metadata_json as any,
        is_system: source.is_system,
        is_active: true,
        created_by: userId,
        cloned_from_id: source.id,
        updated_at: new Date(),
      },
    });

    await this.replaceChildren(newId, organizationId, {
      activities: source.activities.map((a) => ({
        sequence_number: a.sequence_number,
        activity_code: a.activity_code ?? undefined,
        description: a.description,
        duration_hours: a.duration_hours ? Number(a.duration_hours) : undefined,
        is_optional: a.is_optional,
        hold_point_type: a.hold_point_type ?? undefined,
        hold_point_description: a.hold_point_description ?? undefined,
        predecessor_sequences: a.predecessor_sequences,
      })),
      logic_links: source.logic_links.map((l) => ({
        predecessor_seq: l.predecessor_seq,
        successor_seq: l.successor_seq,
        link_type: l.link_type,
        lag_hours: l.lag_hours,
      })),
    });

    // Part 11: Audit log
    void AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'revision_created',
      model_name: 'WorkpackTemplate',
      model_id: newId,
      new_values: { from_id: id, revision: nextRev, family_id: source.template_family_id },
    });

    return this.get(newId, organizationId);
  }

  /** Clone into tenant library as a new family v1 draft. */
  static async cloneToTenant(id: string, organizationId: string, userId: string) {
    const source = await this.get(id, organizationId);
    if (!source) throw new Error('Template not found');
    if (source.lifecycle_status === 'DEPRECATED') {
      throw new Error('Cannot clone a deprecated template');
    }

    const newId = randomUUID();
    await prisma.workpack_templates.create({
      data: {
        id: newId,
        organization_id: organizationId,
        template_family_id: newId,
        revision: 1,
        version_label: '1.0',
        library_scope: 'TENANT',
        lifecycle_status: 'DRAFT',
        name: `${source.name} (Tenant Copy)`,
        category: source.category,
        equipment_type: source.equipment_type,
        equipment_class: source.equipment_class,
        job_type: source.job_type,
        description: source.description,
        planning_json: source.planning_json as any,
        resources_json: source.resources_json as any,
        materials_json: source.materials_json as any,
        safety_json: source.safety_json as any,
        qaqc_json: source.qaqc_json as any,
        references_json: source.references_json as any,
        ai_metadata_json: source.ai_metadata_json as any,
        is_system: false,
        is_active: true,
        created_by: userId,
        cloned_from_id: source.id,
        updated_at: new Date(),
      },
    });

    await this.replaceChildren(newId, organizationId, {
      activities: source.activities.map((a) => ({
        sequence_number: a.sequence_number,
        activity_code: a.activity_code ?? undefined,
        description: a.description,
        duration_hours: a.duration_hours ? Number(a.duration_hours) : undefined,
        is_optional: a.is_optional,
        hold_point_type: a.hold_point_type ?? undefined,
        predecessor_sequences: a.predecessor_sequences,
      })),
      logic_links: source.logic_links.map((l) => ({
        predecessor_seq: l.predecessor_seq,
        successor_seq: l.successor_seq,
        link_type: l.link_type,
        lag_hours: l.lag_hours,
      })),
    });

    // Part 11: Audit log
    void AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'cloned',
      model_name: 'WorkpackTemplate',
      model_id: newId,
      new_values: { from_id: id, library_scope: 'TENANT' },
    });

    return this.get(newId, organizationId);
  }

  static async compare(aId: string, bId: string, organizationId: string) {
    const [a, b] = await Promise.all([this.get(aId, organizationId), this.get(bId, organizationId)]);
    if (!a || !b) throw new Error('One or both templates not found');

    const scalarKeys = [
      'name',
      'category',
      'equipment_type',
      'equipment_class',
      'job_type',
      'description',
      'lifecycle_status',
      'revision',
    ] as const;

    const general = scalarKeys.map((k) => ({
      field: k,
      a: (a as any)[k],
      b: (b as any)[k],
      changed: String((a as any)[k] ?? '') !== String((b as any)[k] ?? ''),
    }));

    const actA = new Map(a.activities.map((x) => [x.activity_code || x.description, x]));
    const actB = new Map(b.activities.map((x) => [x.activity_code || x.description, x]));
    const allKeys = new Set([...actA.keys(), ...actB.keys()]);
    const activities = [...allKeys].map((k) => ({
      key: k,
      in_a: actA.has(k),
      in_b: actB.has(k),
      changed:
        !actA.has(k) ||
        !actB.has(k) ||
        actA.get(k)!.description !== actB.get(k)!.description ||
        String(actA.get(k)!.duration_hours) !== String(actB.get(k)!.duration_hours),
    }));

    return {
      a: { id: a.id, name: a.name, revision: a.revision },
      b: { id: b.id, name: b.name, revision: b.revision },
      sections: {
        general,
        activities,
        planning: {
          changed: JSON.stringify(a.planning_json) !== JSON.stringify(b.planning_json),
        },
        resources: {
          changed: JSON.stringify(a.resources_json) !== JSON.stringify(b.resources_json),
        },
        materials: {
          changed: JSON.stringify(a.materials_json) !== JSON.stringify(b.materials_json),
        },
        safety: { changed: JSON.stringify(a.safety_json) !== JSON.stringify(b.safety_json) },
        qaqc: { changed: JSON.stringify(a.qaqc_json) !== JSON.stringify(b.qaqc_json) },
        references: {
          changed: JSON.stringify(a.references_json) !== JSON.stringify(b.references_json),
        },
        ai_metadata: {
          changed: JSON.stringify(a.ai_metadata_json) !== JSON.stringify(b.ai_metadata_json),
        },
        logic: {
          changed: JSON.stringify(a.logic_links) !== JSON.stringify(b.logic_links),
        },
      },
    };
  }

  /**
   * Instantiate: create a new Workpack from a PUBLISHED template revision.
   * Template row is never mutated.
   */
  static async instantiate(opts: {
    templateId: string;
    organizationId: string;
    siteId: string;
    userId: string;
    title?: string;
    event_id?: string;
    project_id?: string;
    asset_id?: string;
    unit_id?: string;
    discipline_id?: string;
    contractor_id?: string;
    planned_start_date?: Date;
    planned_end_date?: Date;
  }) {
    const tpl = await this.get(opts.templateId, opts.organizationId);
    if (!tpl) throw new Error('Template not found');
    if (tpl.lifecycle_status !== 'PUBLISHED') {
      throw new Error('Only PUBLISHED templates can be instantiated');
    }

    const { WorkpackService } = await import('@/modules/Workpack/Services/WorkpackService');
    const workpack = await WorkpackService.createWorkpack({
      organization_id: opts.organizationId,
      site_id: opts.siteId,
      title: opts.title || tpl.name,
      created_by: opts.userId,
      equipment_type: tpl.equipment_type,
      discipline_id: opts.discipline_id || tpl.discipline_id || undefined,
      asset_id: opts.asset_id,
      unit_id: opts.unit_id,
      project_id: opts.project_id,
      contractor_id: opts.contractor_id,
      planned_start_date: opts.planned_start_date,
      planned_end_date: opts.planned_end_date,
      status: 'draft',
    });

    await prisma.workpack.update({
      where: { id: workpack.id },
      data: {
        template_id: tpl.id,
        job_type: tpl.job_type,
        event_id: opts.event_id || null,
        scope_of_work: tpl.description,
      },
    });

    // Copy activities (planning only — no execution progress)
    let seq = 1;
    for (const a of tpl.activities) {
      await prisma.activity.create({
        data: {
          id: randomUUID(),
          organization_id: opts.organizationId,
          workpack_id: workpack.id,
          site_id: opts.siteId,
          sequence_number: a.sequence_number || seq++,
          description: a.description,
          activity_number: a.activity_code,
          duration_hours: a.duration_hours,
          hold_point_type: a.hold_point_type,
          hold_point_description: a.hold_point_description,
          status: 'not_started',
          created_by: opts.userId,
        },
      });
    }

    // Stamp section snapshots onto workpack equipment_technical_data / attachment for planner use
    await prisma.workpack.update({
      where: { id: workpack.id },
      data: {
        equipment_technical_data: {
          template_revision: tpl.revision,
          template_family_id: tpl.template_family_id,
          planning: tpl.planning_json,
          resources: tpl.resources_json,
          materials: tpl.materials_json,
          safety: tpl.safety_json,
          qaqc: tpl.qaqc_json,
          references: tpl.references_json,
          ai_metadata: tpl.ai_metadata_json,
          logic_links: tpl.logic_links,
        } as any,
      },
    });

    // Part 4: Increment knowledge asset usage metrics (fire-and-forget)
    if (tpl.knowledge_asset_id) {
      void prisma.knowledgeAsset.update({
        where: { id: tpl.knowledge_asset_id },
        data: {
          times_used: { increment: 1 },
          last_seen_at: new Date(),
        },
      }).catch((err: unknown) =>
        console.error('[TemplateLibrary] Knowledge usage update failed:', err)
      );
    }

    // Part 11: Audit log
    void AuditService.log({
      organization_id: opts.organizationId,
      user_id: opts.userId,
      action: 'instantiated',
      model_name: 'WorkpackTemplate',
      model_id: tpl.id,
      new_values: {
        workpack_id: workpack.id,
        template_revision: tpl.revision,
        template_family_id: tpl.template_family_id,
      },
    });

    return { workpack_id: workpack.id, template_id: tpl.id, template_revision: tpl.revision };
  }

  /** Part 6/10: Aggregate platform template statistics. */
  static async platformStats() {
    const [byScope, byStatus] = await Promise.all([
      prisma.workpack_templates.groupBy({
        by: ['library_scope'],
        where: { deleted_at: null },
        _count: { _all: true },
      }),
      prisma.workpack_templates.groupBy({
        by: ['lifecycle_status'],
        where: { deleted_at: null },
        _count: { _all: true },
      }),
    ]);
    const scopeMap: Record<string, number> = {};
    for (const g of byScope) scopeMap[g.library_scope] = g._count._all;
    const statusMap: Record<string, number> = {};
    for (const g of byStatus) statusMap[g.lifecycle_status] = g._count._all;

    const knowledgeImported = await prisma.workpack_templates.count({
      where: { deleted_at: null, knowledge_asset_id: { not: null } },
    });

    return { byScope: scopeMap, byStatus: statusMap, knowledgeImported };
  }

  private static async replaceChildren(
    templateId: string,
    organizationId: string,
    sections?: TemplateSectionPayload
  ) {
    if (sections?.activities) {
      await prisma.workpack_template_activities.deleteMany({ where: { template_id: templateId } });
      let seq = 1;
      for (const a of sections.activities) {
        await prisma.workpack_template_activities.create({
          data: {
            id: randomUUID(),
            organization_id: organizationId,
            template_id: templateId,
            sequence_number: a.sequence_number ?? seq++,
            activity_code: a.activity_code ?? null,
            description: a.description,
            duration_hours: a.duration_hours ?? null,
            is_optional: a.is_optional ?? false,
            hold_point_type: a.hold_point_type ?? null,
            hold_point_description: a.hold_point_description ?? null,
            predecessor_sequences: a.predecessor_sequences ?? [],
            updated_at: new Date(),
          },
        });
      }
    }
    if (sections?.logic_links) {
      await prisma.workpack_template_logic_links.deleteMany({ where: { template_id: templateId } });
      for (const l of sections.logic_links) {
        await prisma.workpack_template_logic_links.create({
          data: {
            id: randomUUID(),
            organization_id: organizationId,
            template_id: templateId,
            predecessor_seq: l.predecessor_seq,
            successor_seq: l.successor_seq,
            link_type: l.link_type || 'FS',
            lag_hours: l.lag_hours ?? 0,
            updated_at: new Date(),
          },
        });
      }
    }
  }
}
