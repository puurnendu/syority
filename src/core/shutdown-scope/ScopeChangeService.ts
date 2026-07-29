import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export class ScopeChangeService {
  /** Create a change request (required after scope is frozen) */
  static async createChangeRequest(data: {
    organizationId: string;
    scopeId: string;
    changeType: string;
    scopeItemId?: string;
    assetId?: string;
    title: string;
    reason: string;
    justification?: string;
    estimatedHours?: number;
    discipline?: string;
    priority?: string;
    userId: string;
  }) {
    const scope = await prisma.shutdownScope.findFirst({
      where: { id: data.scopeId, organization_id: data.organizationId, deleted_at: null },
    });
    if (!scope) throw new Error('Scope not found');
    if (scope.status !== 'approved' && scope.status !== 'frozen') {
      throw new Error('Change requests are only required for approved/frozen scopes. Edit items directly in draft/review.');
    }

    const cr = await prisma.scopeChangeRequest.create({
      data: {
        id: randomUUID(),
        organization_id: data.organizationId,
        scope_id: data.scopeId,
        change_type: data.changeType as any,
        scope_item_id: data.scopeItemId,
        asset_id: data.assetId,
        title: data.title,
        reason: data.reason,
        justification: data.justification,
        estimated_hours: data.estimatedHours,
        discipline: data.discipline,
        priority: data.priority,
        submitted_by: data.userId,
      },
    });

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: data.scopeId,
        user_id: data.userId,
        action: 'change_request',
        entity_type: 'change_request',
        entity_id: cr.id,
        new_value: `${data.changeType}: ${data.title}`,
      },
    });

    return cr;
  }

  /** List change requests for a scope */
  static async listChangeRequests(orgId: string, scopeId: string, status?: string) {
    const where: any = { scope_id: scopeId, organization_id: orgId };
    if (status) where.status = status;

    return prisma.scopeChangeRequest.findMany({
      where,
      orderBy: { submitted_at: 'desc' },
    });
  }

  /** Get change request detail */
  static async getChangeRequest(orgId: string, crId: string) {
    return prisma.scopeChangeRequest.findFirst({
      where: { id: crId, organization_id: orgId },
    });
  }

  /** Approve a change request and apply it */
  static async approveChangeRequest(orgId: string, scopeId: string, crId: string, userId: string, notes?: string) {
    const cr = await prisma.scopeChangeRequest.findFirst({
      where: { id: crId, scope_id: scopeId, organization_id: orgId, status: 'pending' },
    });
    if (!cr) throw new Error('Change request not found or not pending');

    await prisma.scopeChangeRequest.update({
      where: { id: crId },
      data: {
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_notes: notes,
      },
    });

    // Apply the change
    await this.applyChangeRequest(orgId, scopeId, cr, userId);

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: scopeId,
        user_id: userId,
        action: 'approve_change',
        entity_type: 'change_request',
        entity_id: crId,
        new_value: `Approved: ${cr.title}`,
        notes,
      },
    });

    return { success: true, change_type: cr.change_type };
  }

  /** Reject a change request */
  static async rejectChangeRequest(orgId: string, scopeId: string, crId: string, userId: string, notes?: string) {
    const cr = await prisma.scopeChangeRequest.findFirst({
      where: { id: crId, scope_id: scopeId, organization_id: orgId, status: 'pending' },
    });
    if (!cr) throw new Error('Change request not found or not pending');

    await prisma.scopeChangeRequest.update({
      where: { id: crId },
      data: {
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_notes: notes,
      },
    });

    await prisma.scopeAuditLog.create({
      data: {
        id: randomUUID(),
        scope_id: scopeId,
        user_id: userId,
        action: 'reject_change',
        entity_type: 'change_request',
        entity_id: crId,
        new_value: `Rejected: ${cr.title}`,
        notes,
      },
    });

    return { success: true };
  }

  /** Apply an approved change */
  private static async applyChangeRequest(
    orgId: string,
    scopeId: string,
    cr: any,
    userId: string
  ) {
    const now = new Date();

    switch (cr.change_type) {
      case 'added':
      case 'emergency':
      case 'opportunity': {
        // Add new scope item
        if (!cr.asset_id) break;
        const asset = await prisma.asset.findFirst({
          where: { id: cr.asset_id, organization_id: orgId },
          select: { plant_id: true, unit_id: true, system_id: true },
        });
        await prisma.scopeItem.create({
          data: {
            id: randomUUID(),
            organization_id: orgId,
            scope_id: scopeId,
            asset_id: cr.asset_id,
            plant_id: asset?.plant_id,
            unit_id: asset?.unit_id,
            system_id: asset?.system_id,
            reason: cr.reason,
            discipline: cr.discipline,
            priority: cr.priority || 'medium',
            estimated_hours: cr.estimated_hours || 0,
            is_additional: true,
            additional_type: cr.change_type === 'emergency' ? 'emergency' : cr.change_type === 'opportunity' ? 'opportunity' : 'late_addition',
            created_by: userId,
          },
        });
        break;
      }
      case 'removed':
      case 'cancelled': {
        if (cr.scope_item_id) {
          await prisma.scopeItem.update({
            where: { id: cr.scope_item_id },
            data: { deleted_at: now, updated_by: userId },
          });
        }
        break;
      }
      case 'deferred': {
        if (cr.scope_item_id) {
          await prisma.scopeItem.update({
            where: { id: cr.scope_item_id },
            data: { is_deferred: true, updated_by: userId },
          });
          await prisma.scopeDeferral.create({
            data: {
              id: randomUUID(),
              organization_id: orgId,
              scope_id: scopeId,
              scope_item_id: cr.scope_item_id,
              reason: cr.reason,
              deferred_by: userId,
            },
          });
        }
        break;
      }
      case 'modified': {
        if (cr.scope_item_id) {
          const updateData: any = { updated_by: userId };
          if (cr.estimated_hours != null) updateData.estimated_hours = cr.estimated_hours;
          if (cr.discipline) updateData.discipline = cr.discipline;
          if (cr.priority) updateData.priority = cr.priority;
          await prisma.scopeItem.update({
            where: { id: cr.scope_item_id },
            data: updateData,
          });
        }
        break;
      }
    }

    await prisma.scopeChangeRequest.update({
      where: { id: cr.id },
      data: { applied_at: now, applied_by: userId },
    });
  }
}
