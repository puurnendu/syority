import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export class ScopeDeferralService {
  /** Defer a scope item */
  static async deferItem(data: {
    organizationId: string;
    scopeId: string;
    scopeItemId: string;
    reason: string;
    targetEvent?: string;
    targetEventId?: string;
    userId: string;
  }) {
    const item = await prisma.scopeItem.findFirst({
      where: { id: data.scopeItemId, scope_id: data.scopeId, deleted_at: null },
    });
    if (!item) throw new Error('Scope item not found');
    if (item.is_deferred) throw new Error('Item is already deferred');

    const deferral = await prisma.scopeDeferral.create({
      data: {
        id: randomUUID(),
        organization_id: data.organizationId,
        scope_id: data.scopeId,
        scope_item_id: data.scopeItemId,
        reason: data.reason,
        deferred_by: data.userId,
        target_event: data.targetEvent,
        target_event_id: data.targetEventId,
      },
    });

    await prisma.scopeItem.update({
      where: { id: data.scopeItemId },
      data: { is_deferred: true, updated_by: data.userId },
    });

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: data.scopeId,
        user_id: data.userId,
        action: 'defer',
        entity_type: 'deferral',
        entity_id: deferral.id,
        new_value: `Deferred: ${data.reason}`,
      },
    });

    return deferral;
  }

  /** List deferrals for a scope */
  static async listDeferrals(orgId: string, scopeId: string) {
    return prisma.scopeDeferral.findMany({
      where: { scope_id: scopeId, organization_id: orgId },
      include: {
        scope_item: {
          include: {
            asset: { select: { id: true, tag_number: true, name: true } },
          },
        },
      },
      orderBy: { deferred_at: 'desc' },
    });
  }

  /** Carry forward deferrals to a new scope (next TA) */
  static async carryForward(data: {
    organizationId: string;
    fromScopeId: string;
    toScopeId: string;
    deferralIds?: string[];
    userId: string;
  }) {
    // Verify target scope exists and is in draft
    const toScope = await prisma.shutdownScope.findFirst({
      where: { id: data.toScopeId, organization_id: data.organizationId, deleted_at: null },
    });
    if (!toScope) throw new Error('Target scope not found');
    if (toScope.status !== 'draft') throw new Error('Target scope must be in draft status');

    // Get deferrals to carry forward
    const where: any = {
      scope_id: data.fromScopeId,
      organization_id: data.organizationId,
      carried_forward: false,
    };
    if (data.deferralIds) where.id = { in: data.deferralIds };

    const deferrals = await prisma.scopeDeferral.findMany({
      where,
      include: {
        scope_item: {
          include: {
            asset: { select: { id: true, plant_id: true, unit_id: true, system_id: true } },
            issue_links: true,
          },
        },
      },
    });

    let created = 0;
    for (const def of deferrals) {
      const si = def.scope_item;

      // Create new scope item in target scope
      const newItemId = randomUUID();
      await prisma.scopeItem.create({
        data: {
          id: newItemId,
          organization_id: data.organizationId,
          scope_id: data.toScopeId,
          asset_id: si.asset_id,
          plant_id: si.plant_id,
          unit_id: si.unit_id,
          system_id: si.system_id,
          reason: `[Carried Forward] ${si.reason}`,
          discipline: si.discipline,
          priority: si.priority,
          complexity: si.complexity,
          estimated_hours: si.estimated_hours,
          template_id: si.template_id,
          template_name: si.template_name,
          planner_notes: `Deferred from previous TA. Reason: ${def.reason}`,
          ai_previous_ta: def.scope_id,
          created_by: data.userId,
        },
      });

      // Copy issue links
      if (si.issue_links.length > 0) {
        await prisma.scopeItemIssueLink.createMany({
          data: si.issue_links.map((l) => ({
            id: randomUUID(),
            scope_item_id: newItemId,
            issue_id: l.issue_id,
          })),
          skipDuplicates: true,
        });
      }

      // Mark deferral as carried forward
      await prisma.scopeDeferral.update({
        where: { id: def.id },
        data: {
          carried_forward: true,
          carried_to_scope_id: data.toScopeId,
          carried_at: new Date(),
        },
      });

      created++;
    }

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: data.toScopeId,
        user_id: data.userId,
        action: 'carry_forward',
        entity_type: 'deferral',
        new_value: `${created} items carried forward from previous TA`,
      },
    });

    return { carried_forward: created, total_deferrals: deferrals.length };
  }
}
