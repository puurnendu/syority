import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export class ScopeCloneService {
  /** Clone scope from a previous event into a new scope */
  static async cloneScope(data: {
    organizationId: string;
    fromScopeId: string;
    toEventId: string;
    name: string;
    userId: string;
  }) {
    // Verify source scope
    const source = await prisma.shutdownScope.findFirst({
      where: { id: data.fromScopeId, organization_id: data.organizationId, deleted_at: null },
      include: {
        event: { select: { name: true, code: true } },
      },
    });
    if (!source) throw new Error('Source scope not found');

    // Verify target event doesn't already have a scope
    const existing = await prisma.shutdownScope.findFirst({
      where: { event_id: data.toEventId, deleted_at: null },
    });
    if (existing) throw new Error('Target event already has a scope');

    // Verify target event
    const targetEvent = await prisma.event.findFirst({
      where: { id: data.toEventId, organization_id: data.organizationId },
      select: { id: true, site_id: true, name: true },
    });
    if (!targetEvent) throw new Error('Target event not found');

    // Create new scope
    const newScopeId = randomUUID();
    const newScope = await prisma.shutdownScope.create({
      data: {
        id: newScopeId,
        organization_id: data.organizationId,
        event_id: data.toEventId,
        site_id: targetEvent.site_id,
        name: data.name,
        description: `Cloned from ${source.event.name} (${source.event.code})`,
        objectives: source.objectives,
        budget_manhours: source.budget_manhours,
        budget_cost: source.budget_cost,
        created_by: data.userId,
      },
    });

    // Clone scope items (non-deferred only)
    const sourceItems = await prisma.scopeItem.findMany({
      where: { scope_id: data.fromScopeId, deleted_at: null, is_deferred: false },
      include: { issue_links: true },
    });

    let cloned = 0;
    for (const item of sourceItems) {
      const newItemId = randomUUID();
      await prisma.scopeItem.create({
        data: {
          id: newItemId,
          organization_id: data.organizationId,
          scope_id: newScopeId,
          asset_id: item.asset_id,
          plant_id: item.plant_id,
          unit_id: item.unit_id,
          system_id: item.system_id,
          reason: item.reason,
          discipline: item.discipline,
          priority: item.priority,
          complexity: item.complexity,
          estimated_hours: item.estimated_hours,
          template_id: item.template_id,
          template_name: item.template_name,
          planner_notes: `[Cloned from ${source.event.code}]`,
          ai_previous_ta: source.event.code,
          created_by: data.userId,
        },
      });

      // Copy issue links
      if (item.issue_links.length > 0) {
        await prisma.scopeItemIssueLink.createMany({
          data: item.issue_links.map((l) => ({
            id: randomUUID(),
            scope_item_id: newItemId,
            issue_id: l.issue_id,
          })),
          skipDuplicates: true,
        });
      }

      cloned++;
    }

    // Clone packages
    const sourcePackages = await prisma.scopePackage.findMany({
      where: { scope_id: data.fromScopeId },
    });
    for (const pkg of sourcePackages) {
      await prisma.scopePackage.create({
        data: {
          id: randomUUID(),
          organization_id: data.organizationId,
          scope_id: newScopeId,
          name: pkg.name,
          package_type: pkg.package_type,
          discipline: pkg.discipline,
          area: pkg.area,
          contractor: pkg.contractor,
          risk_level: pkg.risk_level,
          description: pkg.description,
          sort_order: pkg.sort_order,
          created_by: data.userId,
        },
      });
    }

    // Audit
    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: newScopeId,
        user_id: data.userId,
        action: 'clone',
        entity_type: 'scope',
        entity_id: newScopeId,
        new_value: `Cloned ${cloned} items from ${source.event.code}`,
      },
    });

    return {
      scope: newScope,
      cloned_items: cloned,
      cloned_packages: sourcePackages.length,
      source_event: source.event.code,
    };
  }
}
