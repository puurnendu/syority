import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export class ScopeItemService {
  /** Add a scope item (from issue or manual) */
  static async addItem(data: {
    organizationId: string;
    scopeId: string;
    assetId: string;
    reason: string;
    discipline?: string;
    priority?: string;
    complexity?: string;
    requestedBy?: string;
    estimatedHours?: number;
    templateId?: string;
    templateName?: string;
    plannerNotes?: string;
    issueIds?: string[];
    isAdditional?: boolean;
    additionalType?: string;
    userId: string;
  }) {
    // Verify scope is editable
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: data.scopeId, organization_id: data.organizationId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');
    if (scope.status === 'frozen' || scope.status === 'closed') {
      throw new Error(`Cannot add items to scope in ${scope.status} status. Use a Change Request.`);
    }

    // Get asset hierarchy context
    const asset = await prisma.asset.findFirst({
      where: { id: data.assetId, organization_id: data.organizationId },
      select: { id: true, plant_id: true, unit_id: true, system_id: true, tag_number: true, name: true },
    });
    if (!asset) throw new Error('Asset not found');

    const item = await prisma.scopeItem.create({
      data: {
        id: randomUUID(),
        organization_id: data.organizationId,
        scope_id: data.scopeId,
        asset_id: data.assetId,
        plant_id: asset.plant_id,
        unit_id: asset.unit_id,
        system_id: asset.system_id,
        reason: data.reason,
        discipline: data.discipline,
        priority: data.priority || 'medium',
        complexity: data.complexity || 'standard',
        requested_by: data.requestedBy,
        estimated_hours: data.estimatedHours || 0,
        template_id: data.templateId,
        template_name: data.templateName,
        planner_notes: data.plannerNotes,
        is_additional: data.isAdditional || false,
        additional_type: data.additionalType,
        created_by: data.userId,
      },
    });

    // Link issues
    if (data.issueIds && data.issueIds.length > 0) {
      await prisma.scopeItemIssueLink.createMany({
        data: data.issueIds.map((issueId) => ({
          id: randomUUID(),
          scope_item_id: item.id,
          issue_id: issueId,
        })),
        skipDuplicates: true,
      });
    }

    // Audit
    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: data.scopeId,
        user_id: data.userId,
        action: 'add_item',
        entity_type: 'scope_item',
        entity_id: item.id,
        new_value: `${asset.tag_number} — ${data.reason}`,
      },
    });

    return item;
  }

  /** Bulk add items from issue selection */
  static async bulkAddFromIssues(data: {
    organizationId: string;
    scopeId: string;
    issueIds: string[];
    userId: string;
  }) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: data.scopeId, organization_id: data.organizationId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');
    if (scope.status === 'frozen' || scope.status === 'closed') {
      throw new Error('Cannot bulk-add to frozen/closed scope');
    }

    // Get matched issues with assets
    const issues = await prisma.engineeringIssue.findMany({
      where: {
        id: { in: data.issueIds },
        organization_id: data.organizationId,
        asset_id: { not: null },
        deleted_at: null,
      },
      include: {
        asset: { select: { id: true, plant_id: true, unit_id: true, system_id: true, tag_number: true } },
      },
    });

    // Group by asset — one scope item per asset
    const assetIssueMap = new Map<string, typeof issues>();
    for (const issue of issues) {
      const key = issue.asset_id!;
      if (!assetIssueMap.has(key)) assetIssueMap.set(key, []);
      assetIssueMap.get(key)!.push(issue);
    }

    // Check existing scope items
    const existingItems = await prisma.scopeItem.findMany({
      where: { scope_id: data.scopeId, asset_id: { in: [...assetIssueMap.keys()] }, deleted_at: null },
      select: { id: true, asset_id: true },
    });
    const existingAssetIds = new Set(existingItems.map((i) => i.asset_id));

    const created: string[] = [];
    const linked: string[] = [];

    for (const [assetId, assetIssues] of assetIssueMap) {
      if (existingAssetIds.has(assetId)) {
        // Asset already in scope — link issues to existing item
        const existingItem = existingItems.find((i) => i.asset_id === assetId)!;
        await prisma.scopeItemIssueLink.createMany({
          data: assetIssues.map((i) => ({
            id: randomUUID(),
            scope_item_id: existingItem.id,
            issue_id: i.id,
          })),
          skipDuplicates: true,
        });
        linked.push(assetId);
      } else {
        // New scope item
        const firstIssue = assetIssues[0];
        const reasons = assetIssues.map((i) => i.problem).join('; ');
        const itemId = randomUUID();

        await prisma.scopeItem.create({
          data: {
            id: itemId,
            organization_id: data.organizationId,
            scope_id: data.scopeId,
            asset_id: assetId,
            plant_id: firstIssue.asset!.plant_id,
            unit_id: firstIssue.asset!.unit_id,
            system_id: firstIssue.asset!.system_id,
            reason: reasons.slice(0, 2000),
            discipline: firstIssue.discipline || firstIssue.ai_discipline,
            priority: firstIssue.priority === 'unclassified' ? 'medium' : firstIssue.priority,
            created_by: data.userId,
          },
        });

        await prisma.scopeItemIssueLink.createMany({
          data: assetIssues.map((i) => ({
            id: randomUUID(),
            scope_item_id: itemId,
            issue_id: i.id,
          })),
          skipDuplicates: true,
        });

        created.push(assetId);
      }
    }

    // Audit
    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: data.scopeId,
        user_id: data.userId,
        action: 'bulk_add',
        entity_type: 'scope_item',
        new_value: `${created.length} created, ${linked.length} linked`,
      },
    });

    return { created: created.length, linked: linked.length, skipped: data.issueIds.length - issues.length };
  }

  /** List scope items with filters */
  static async listItems(params: {
    organizationId: string;
    scopeId: string;
    discipline?: string;
    priority?: string;
    unitId?: string;
    systemId?: string;
    packageId?: string;
    isDeferred?: boolean;
    isAdditional?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { organizationId, scopeId, page = 1, pageSize = 50 } = params;
    const where: any = {
      organization_id: organizationId,
      scope_id: scopeId,
      deleted_at: null,
    };
    if (params.discipline) where.discipline = params.discipline;
    if (params.priority) where.priority = params.priority;
    if (params.unitId) where.unit_id = params.unitId;
    if (params.systemId) where.system_id = params.systemId;
    if (params.packageId) where.package_id = params.packageId;
    if (params.isDeferred !== undefined) where.is_deferred = params.isDeferred;
    if (params.isAdditional !== undefined) where.is_additional = params.isAdditional;
    if (params.search) {
      where.OR = [
        { reason: { contains: params.search, mode: 'insensitive' } },
        { planner_notes: { contains: params.search, mode: 'insensitive' } },
        { asset: { tag_number: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.scopeItem.findMany({
        where,
        include: {
          asset: { select: { id: true, tag_number: true, name: true, description: true, criticality: true } },
          package: { select: { id: true, name: true } },
          issue_links: {
            include: {
              issue: { select: { id: true, issue_number: true, problem: true, department: true, priority: true } },
            },
          },
          _count: { select: { issue_links: true, deferrals: true } },
        },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scopeItem.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /** Update a scope item */
  static async updateItem(orgId: string, scopeId: string, itemId: string, data: Record<string, any>, userId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');
    if (scope.status === 'frozen' || scope.status === 'closed') {
      throw new Error(`Cannot edit items in ${scope.status} scope. Use a Change Request.`);
    }

    const item = await prisma.scopeItem.findFirst({
      where: { id: itemId, scope_id: scopeId, deleted_at: null },
    });
    if (!item) throw new Error('Item not found');

    const allowedFields = [
      'reason', 'discipline', 'priority', 'complexity', 'requested_by',
      'estimated_hours', 'template_id', 'template_name', 'planner_notes',
      'sort_order', 'package_id',
    ];
    const updateData: any = { updated_by: userId };
    for (const f of allowedFields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    const updated = await prisma.scopeItem.update({
      where: { id: itemId },
      data: updateData,
    });

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: scopeId,
        user_id: userId,
        action: 'update_item',
        entity_type: 'scope_item',
        entity_id: itemId,
      },
    });

    return updated;
  }

  /** Remove a scope item (soft delete) */
  static async removeItem(orgId: string, scopeId: string, itemId: string, userId: string) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: scopeId, organization_id: orgId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');
    if (scope.status === 'frozen' || scope.status === 'closed') {
      throw new Error(`Cannot remove items from ${scope.status} scope. Use a Change Request.`);
    }

    await prisma.scopeItem.update({
      where: { id: itemId },
      data: { deleted_at: new Date(), updated_by: userId },
    });

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: scopeId,
        user_id: userId,
        action: 'remove_item',
        entity_type: 'scope_item',
        entity_id: itemId,
      },
    });

    return { success: true };
  }
}
