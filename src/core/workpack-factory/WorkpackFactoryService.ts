import { prisma } from '@/lib/prisma';
import { WorkpackAiService } from '@/core/workpack-intelligence/WorkpackAiService';

/**
 * M9 — Workpack Factory Orchestration Service.
 *
 * Thin read-only orchestration layer over existing services.
 * DOES NOT:
 *   - create workpacks (delegates to WorkpackIntelligenceService)
 *   - modify scope (upstream is immutable)
 *   - touch M8.13 progress / M8.15 Equipment 360
 *   - introduce new schema / models
 *
 * Business rules (immutable):
 *   ONE ScopeItem → ONE Workpack
 *   ONE Workpack  → ONE Primary Equipment
 */
export class WorkpackFactoryService {
  /**
   * Get the factory production queue.
   *
   * Returns all scope items from approved/frozen scopes, enriched with:
   *   - Asset metadata (tag, name, type)
   *   - Workpack status (pending / created / deferred)
   *   - Created workpack summary (if exists)
   *
   * Supports filtering by event, scope, discipline, priority,
   * equipment type, unit, system, and status.
   */
  static async getQueue(
    orgId: string,
    filters: {
      eventId?: string;
      scopeId?: string;
      discipline?: string;
      priority?: string;
      equipmentType?: string;
      unitId?: string;
      systemId?: string;
      status?: 'pending' | 'created' | 'deferred' | 'all';
      search?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    // ── Build scope filter ─────────────────────────────────────────────────
    const scopeWhere: any = {
      organization_id: orgId,
      deleted_at: null,
      status: { in: ['approved', 'frozen'] },
    };
    if (filters.eventId) scopeWhere.event_id = filters.eventId;
    if (filters.scopeId) scopeWhere.id = filters.scopeId;

    // Get qualifying scopes
    const scopes = await prisma.shutdownScope.findMany({
      where: scopeWhere,
      select: {
        id: true,
        name: true,
        status: true,
        event_id: true,
        event: { select: { id: true, name: true, code: true } },
      },
    });

    if (scopes.length === 0) {
      return { items: [], totals: { total: 0, pending: 0, created: 0, deferred: 0, manual: 0 }, scopes: [] };
    }

    const scopeIds = scopes.map((s) => s.id);

    // ── Build scope item filter ────────────────────────────────────────────
    const itemWhere: any = {
      scope_id: { in: scopeIds },
      organization_id: orgId,
      deleted_at: null,
    };
    if (filters.discipline) itemWhere.discipline = filters.discipline;
    if (filters.priority) itemWhere.priority = filters.priority;
    if (filters.unitId) itemWhere.unit_id = filters.unitId;
    if (filters.systemId) itemWhere.system_id = filters.systemId;

    // Status filter
    if (filters.status === 'pending') {
      itemWhere.workpack_id = null;
      itemWhere.is_deferred = false;
    } else if (filters.status === 'created') {
      itemWhere.workpack_id = { not: null };
    } else if (filters.status === 'deferred') {
      itemWhere.is_deferred = true;
    }
    // 'all' or undefined = no status filter

    // ── Query items with asset + workpack ──────────────────────────────────
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 100;

    const [items, totalCount] = await Promise.all([
      prisma.scopeItem.findMany({
        where: itemWhere,
        include: {
          asset: {
            select: {
              id: true,
              tag_number: true,
              name: true,
              asset_type: true,
              equipment_type_id: true,
              plant_id: true,
              unit_id: true,
              system_id: true,
              plant: { select: { id: true, name: true } },
              unit: { select: { id: true, name: true, code: true } },
              system: { select: { id: true, name: true, code: true } },
            },
          },
          scope: {
            select: {
              id: true,
              name: true,
              status: true,
              event: { select: { id: true, name: true, code: true } },
            },
          },
          workpack: {
            select: {
              id: true,
              workpack_number: true,
              title: true,
              status: true,
              readiness_score: true,
              compliance_score: true,
              created_at: true,
            },
          },
        },
        orderBy: [
          { priority: 'asc' },      // critical first
          { discipline: 'asc' },
          { sort_order: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scopeItem.count({ where: itemWhere }),
    ]);

    // ── Post-filter by equipment type (asset field) ───────────────────────
    let filteredItems = items;
    if (filters.equipmentType) {
      const et = filters.equipmentType.toLowerCase();
      filteredItems = items.filter(
        (i) =>
          i.asset?.asset_type?.toLowerCase().includes(et) ||
          false
      );
    }

    // ── Post-filter by search (tag number or asset name) ──────────────────
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      filteredItems = filteredItems.filter(
        (i) =>
          i.asset?.tag_number?.toLowerCase().includes(q) ||
          i.asset?.name?.toLowerCase().includes(q) ||
          i.reason?.toLowerCase().includes(q)
      );
    }

    // ── Derive status for each item ───────────────────────────────────────
    const queueItems = filteredItems.map((item) => ({
      id: item.id,
      scope_id: item.scope_id,
      scope_name: item.scope?.name,
      event_name: item.scope?.event?.name,
      event_id: item.scope?.event?.id,
      // Asset
      asset_id: item.asset_id,
      tag_number: item.asset?.tag_number,
      asset_name: item.asset?.name,
      asset_type: item.asset?.asset_type,
      equipment_type_id: item.asset?.equipment_type_id,
      plant_name: item.asset?.plant?.name,
      unit_name: item.asset?.unit?.name,
      system_name: item.asset?.system?.name,
      // Scope detail
      reason: item.reason,
      discipline: item.discipline,
      priority: item.priority,
      complexity: item.complexity,
      estimated_hours: item.estimated_hours,
      // Pre-selected template (from scoping phase)
      template_id: item.template_id,
      template_name: item.template_name,
      // Status
      factory_status: item.is_deferred
        ? 'deferred' as const
        : item.workpack_id
          ? 'created' as const
          : 'pending' as const,
      is_deferred: item.is_deferred,
      is_additional: item.is_additional,
      // Created workpack (if exists)
      workpack: item.workpack
        ? {
            id: item.workpack.id,
            workpack_number: item.workpack.workpack_number,
            title: item.workpack.title,
            status: item.workpack.status,
            readiness_score: item.workpack.readiness_score,
            compliance_score: item.workpack.compliance_score,
            created_at: item.workpack.created_at,
          }
        : null,
    }));

    // ── Compute totals ────────────────────────────────────────────────────
    // Use a single groupBy for efficiency instead of multiple count queries
    const allItems = await prisma.scopeItem.findMany({
      where: {
        scope_id: { in: scopeIds },
        organization_id: orgId,
        deleted_at: null,
      },
      select: {
        workpack_id: true,
        is_deferred: true,
        template_id: true,
      },
    });

    const totals = {
      total: allItems.length,
      pending: allItems.filter((i) => !i.workpack_id && !i.is_deferred).length,
      created: allItems.filter((i) => i.workpack_id != null).length,
      deferred: allItems.filter((i) => i.is_deferred).length,
      manual: allItems.filter((i) => !i.workpack_id && !i.is_deferred && !i.template_id).length,
    };

    return {
      items: queueItems,
      totals,
      scopes: scopes.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        event_id: s.event_id,
        event_name: s.event?.name,
        event_code: s.event?.code,
      })),
      page,
      pageSize,
      totalCount,
    };
  }

  /**
   * Get template recommendations for a list of scope items.
   *
   * Delegates to existing WorkpackAiService.recommendTemplate().
   * Returns advisory recommendations — planner may override.
   *
   * Performance: Groups items by (assetType, discipline) to avoid
   * redundant WorkpackAiService calls. For a typical STO deployment
   * with ~200 scope items across ~5-8 equipment types and ~4 disciplines,
   * this reduces template queries from N to D (unique combos, typically 8-15).
   */
  static async getTemplateRecommendations(
    orgId: string,
    scopeItemIds: string[]
  ): Promise<
    Array<{
      scopeItemId: string;
      assetType: string | null;
      recommendations: Array<{
        templateId: string;
        templateName: string;
        matchReason: string;
        confidence: number;
      }>;
    }>
  > {
    // Fetch scope items with asset info
    const items = await prisma.scopeItem.findMany({
      where: {
        id: { in: scopeItemIds },
        organization_id: orgId,
        deleted_at: null,
      },
      select: {
        id: true,
        discipline: true,
        reason: true,
        template_id: true,
        template_name: true,
        asset: {
          select: { asset_type: true },
        },
      },
    });

    const results: Array<{
      scopeItemId: string;
      assetType: string | null;
      recommendations: Array<{
        templateId: string;
        templateName: string;
        matchReason: string;
        confidence: number;
      }>;
    }> = [];

    // ── Separate pre-selected items from items needing AI recommendation ──
    const needsRecommendation: typeof items = [];

    for (const item of items) {
      if (item.template_id && item.template_name) {
        results.push({
          scopeItemId: item.id,
          assetType: item.asset?.asset_type || null,
          recommendations: [
            {
              templateId: item.template_id,
              templateName: item.template_name,
              matchReason: 'Pre-selected during scoping',
              confidence: 1.0,
            },
          ],
        });
      } else {
        needsRecommendation.push(item);
      }
    }

    // ── Batch: group by (assetType, discipline) to avoid N+1 ─────────────
    // Items with the same equipment type and discipline will get the same
    // template recommendations from WorkpackAiService, so we query once
    // per unique combination.
    const groupKey = (at: string | null | undefined, disc: string | null) =>
      `${(at || '').toLowerCase()}|||${(disc || '').toLowerCase()}`;

    const groups = new Map<string, {
      assetType: string | undefined;
      discipline: string | undefined;
      itemIds: string[];
    }>();

    for (const item of needsRecommendation) {
      const key = groupKey(item.asset?.asset_type, item.discipline);
      if (!groups.has(key)) {
        groups.set(key, {
          assetType: item.asset?.asset_type || undefined,
          discipline: item.discipline || undefined,
          itemIds: [],
        });
      }
      groups.get(key)!.itemIds.push(item.id);
    }

    // Query once per unique (assetType, discipline) combination
    for (const [, group] of groups) {
      const { recommendations } = await WorkpackAiService.recommendTemplate(
        orgId,
        {
          assetType: group.assetType,
          equipmentType: group.assetType,
          discipline: group.discipline,
        }
      );

      // Apply same recommendations to all items in this group
      for (const itemId of group.itemIds) {
        const item = needsRecommendation.find((i) => i.id === itemId)!;
        results.push({
          scopeItemId: itemId,
          assetType: item.asset?.asset_type || null,
          recommendations,
        });
      }
    }

    return results;
  }

  /**
   * Get factory KPIs for display on the factory floor.
   *
   * Computed from live queries — no denormalized counters.
   */
  static async getKpis(
    orgId: string,
    eventId?: string
  ) {
    // Get approved/frozen scopes
    const scopeWhere: any = {
      organization_id: orgId,
      deleted_at: null,
      status: { in: ['approved', 'frozen'] },
    };
    if (eventId) scopeWhere.event_id = eventId;

    const scopes = await prisma.shutdownScope.findMany({
      where: scopeWhere,
      select: { id: true },
    });
    const scopeIds = scopes.map((s) => s.id);
    if (scopeIds.length === 0) {
      return {
        approved_scope_items: 0,
        workpacks_created: 0,
        pending: 0,
        deferred: 0,
        manual_required: 0,
        this_week: 0,
        last_week: 0,
      };
    }

    const itemWhere = {
      scope_id: { in: scopeIds },
      organization_id: orgId,
      deleted_at: null as Date | null,
    };

    const allItems = await prisma.scopeItem.findMany({
      where: itemWhere,
      select: {
        workpack_id: true,
        is_deferred: true,
        template_id: true,
      },
    });

    const created = allItems.filter((i) => i.workpack_id != null).length;
    const deferred = allItems.filter((i) => i.is_deferred).length;
    const pending = allItems.filter((i) => !i.workpack_id && !i.is_deferred).length;
    const manualRequired = allItems.filter(
      (i) => !i.workpack_id && !i.is_deferred && !i.template_id
    ).length;

    // Weekly stats: workpacks created via instantiation in the last 7 and 14 days
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const createdItemIds = allItems
      .filter((i) => i.workpack_id)
      .map((i) => i.workpack_id!);

    let thisWeek = 0;
    let lastWeek = 0;

    if (createdItemIds.length > 0) {
      thisWeek = await prisma.workpack.count({
        where: {
          id: { in: createdItemIds },
          created_at: { gte: oneWeekAgo },
        },
      });

      const lastTwoWeeks = await prisma.workpack.count({
        where: {
          id: { in: createdItemIds },
          created_at: { gte: twoWeeksAgo, lt: oneWeekAgo },
        },
      });
      lastWeek = lastTwoWeeks;
    }

    return {
      approved_scope_items: allItems.length,
      workpacks_created: created,
      pending,
      deferred,
      manual_required: manualRequired,
      this_week: thisWeek,
      last_week: lastWeek,
    };
  }

  /**
   * Preview what a workpack would contain before creation.
   *
   * Reads template data — does NOT create any records.
   */
  static async preview(
    orgId: string,
    scopeItemId: string,
    templateId: string
  ) {
    const { TemplateLibraryService } = await import(
      '@/core/planning/TemplateLibraryService'
    );

    // Get scope item + asset
    const scopeItem = await prisma.scopeItem.findFirst({
      where: { id: scopeItemId, organization_id: orgId, deleted_at: null },
      include: {
        asset: {
          select: {
            id: true,
            tag_number: true,
            name: true,
            asset_type: true,
          },
        },
        scope: {
          select: { id: true, name: true, status: true, event_id: true },
        },
      },
    });
    if (!scopeItem) throw new Error('Scope item not found');

    // Idempotency check
    if (scopeItem.workpack_id) {
      throw new Error('This scope item already has a workpack');
    }

    // Get template
    const template = await TemplateLibraryService.get(templateId, orgId);
    if (!template) throw new Error('Template not found');
    if (template.lifecycle_status !== 'PUBLISHED') {
      throw new Error('Only PUBLISHED templates can be used');
    }

    return {
      scope_item: {
        id: scopeItem.id,
        reason: scopeItem.reason,
        discipline: scopeItem.discipline,
        priority: scopeItem.priority,
        estimated_hours: scopeItem.estimated_hours,
      },
      asset: scopeItem.asset,
      template: {
        id: template.id,
        name: template.name,
        equipment_type: template.equipment_type,
        job_type: template.job_type,
        revision: template.revision,
        lifecycle_status: template.lifecycle_status,
      },
      expected_activities: (template.activities || []).map((a: any) => ({
        sequence_number: a.sequence_number,
        description: a.description,
        duration_hours: a.duration_hours ? Number(a.duration_hours) : null,
        is_optional: a.is_optional,
        hold_point_type: a.hold_point_type,
      })),
      expected_resources: template.resources_json as any[] || [],
      expected_materials: template.materials_json as any[] || [],
      expected_certificates: (template.qaqc_json as any)?.certificate_types || [],
    };
  }
}
