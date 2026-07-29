import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export class ScopeComparisonService {
  /** Compare two scopes side-by-side */
  static async compareScopes(orgId: string, scopeAId: string, scopeBId: string, userId: string) {
    const [scopeA, scopeB] = await Promise.all([
      prisma.shutdownScope.findFirst({ where: { id: scopeAId, organization_id: orgId, deleted_at: null }, select: { id: true, name: true, event: { select: { name: true, code: true } } } }),
      prisma.shutdownScope.findFirst({ where: { id: scopeBId, organization_id: orgId, deleted_at: null }, select: { id: true, name: true, event: { select: { name: true, code: true } } } }),
    ]);
    if (!scopeA || !scopeB) throw new Error('One or both scopes not found');

    // Get items with asset IDs
    const [itemsA, itemsB] = await Promise.all([
      prisma.scopeItem.findMany({
        where: { scope_id: scopeAId, deleted_at: null },
        include: { asset: { select: { id: true, tag_number: true, name: true } } },
      }),
      prisma.scopeItem.findMany({
        where: { scope_id: scopeBId, deleted_at: null },
        include: { asset: { select: { id: true, tag_number: true, name: true } } },
      }),
    ]);

    const assetIdsA = new Set(itemsA.map((i) => i.asset_id));
    const assetIdsB = new Set(itemsB.map((i) => i.asset_id));

    const added: any[] = [];    // In B but not A
    const removed: any[] = [];  // In A but not B
    const same: any[] = [];     // In both
    const deferred: any[] = []; // In A but deferred

    for (const item of itemsB) {
      if (!assetIdsA.has(item.asset_id)) {
        added.push({
          asset_id: item.asset_id,
          tag: item.asset.tag_number,
          name: item.asset.name,
          discipline: item.discipline,
          priority: item.priority,
          estimated_hours: item.estimated_hours,
          reason: item.reason,
        });
      } else {
        same.push({
          asset_id: item.asset_id,
          tag: item.asset.tag_number,
          name: item.asset.name,
          discipline: item.discipline,
        });
      }
    }

    for (const item of itemsA) {
      if (!assetIdsB.has(item.asset_id)) {
        if (item.is_deferred) {
          deferred.push({
            asset_id: item.asset_id,
            tag: item.asset.tag_number,
            name: item.asset.name,
            discipline: item.discipline,
            reason: item.reason,
          });
        } else {
          removed.push({
            asset_id: item.asset_id,
            tag: item.asset.tag_number,
            name: item.asset.name,
            discipline: item.discipline,
            reason: item.reason,
          });
        }
      }
    }

    // Save comparison
    const comparison = await prisma.scopeComparison.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        scope_a_id: scopeAId,
        scope_b_id: scopeBId,
        total_added: added.length,
        total_removed: removed.length,
        total_deferred: deferred.length,
        total_same: same.length,
        diff_detail: { added, removed, deferred, same },
        created_by: userId,
      },
    });

    return {
      comparison_id: comparison.id,
      scope_a: scopeA,
      scope_b: scopeB,
      summary: {
        added: added.length,
        removed: removed.length,
        deferred: deferred.length,
        same: same.length,
      },
      detail: { added, removed, deferred, same },
    };
  }
}
