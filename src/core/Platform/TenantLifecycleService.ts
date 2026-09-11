/**
 * M7.7.1 — Tenant Lifecycle Service
 *
 * State machine for organization lifecycle management.
 *
 * States: draft → pending_approval → provisioning → active → suspended / expired → archived → deleted
 *
 * Every transition creates a SystemAuditLog entry.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type LifecycleStatus =
  | 'draft'
  | 'pending_approval'
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'archived'
  | 'deleted';

/** Valid transitions: from → allowed targets */
const VALID_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  draft: ['pending_approval', 'provisioning', 'deleted'],
  pending_approval: ['provisioning', 'active', 'deleted'],
  provisioning: ['active', 'failed' as any, 'deleted'],
  active: ['suspended', 'expired', 'archived', 'deleted'],
  suspended: ['active', 'archived', 'deleted'],
  expired: ['active', 'archived', 'deleted'],
  archived: ['active', 'deleted'],
  deleted: [], // Terminal state
};

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class TenantLifecycleService {

  /**
   * Transition an organization to a new lifecycle status.
   * Validates the transition, updates the org, and creates an audit log.
   */
  async transitionTo(
    orgId: string,
    newStatus: LifecycleStatus,
    operatorId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, lifecycle_status: true },
    });

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const currentStatus = (org.lifecycle_status ?? 'active') as LifecycleStatus;
    const allowedTargets = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowedTargets.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTargets.join(', ')}`,
      };
    }

    // Build update data
    const updateData: any = {
      lifecycle_status: newStatus,
      lifecycle_changed_at: new Date(),
      lifecycle_changed_by: operatorId,
    };

    // Status-specific side effects
    if (newStatus === 'suspended') {
      updateData.suspended_at = new Date();
      updateData.suspension_reason = reason ?? null;
      updateData.is_active = false;
    } else if (newStatus === 'active') {
      updateData.is_active = true;
      updateData.suspended_at = null;
      updateData.suspension_reason = null;
    } else if (newStatus === 'deleted') {
      updateData.deleted_at = new Date();
      updateData.is_active = false;
    } else if (newStatus === 'archived') {
      updateData.is_active = false;
    } else if (newStatus === 'expired') {
      updateData.is_active = false;
    }

    // Execute in transaction
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: orgId },
        data: updateData,
      }),
      prisma.systemAuditLog.create({
        data: {
          user_id: operatorId,
          target_tenant_id: orgId,
          action: `tenant.lifecycle.${newStatus}`,
          metadata: {
            from: currentStatus,
            to: newStatus,
            reason: reason ?? null,
            orgName: org.name,
          },
        },
      }),
    ]);

    logger.audit('TenantLifecycleService', `${org.name}: ${currentStatus} → ${newStatus}`, {
      orgId, operatorId, reason,
    });

    return { success: true };
  }

  // ─── Convenience Methods ───────────────────────────────────────────────────

  async activate(orgId: string, operatorId: string) {
    return this.transitionTo(orgId, 'active', operatorId, 'Activated by admin');
  }

  async suspend(orgId: string, operatorId: string, reason?: string) {
    return this.transitionTo(orgId, 'suspended', operatorId, reason ?? 'Suspended by admin');
  }

  async archive(orgId: string, operatorId: string) {
    return this.transitionTo(orgId, 'archived', operatorId, 'Archived by admin');
  }

  async restore(orgId: string, operatorId: string) {
    return this.transitionTo(orgId, 'active', operatorId, 'Restored by admin');
  }

  async softDelete(orgId: string, operatorId: string) {
    return this.transitionTo(orgId, 'deleted', operatorId, 'Deleted by admin');
  }

  async expire(orgId: string, operatorId: string) {
    return this.transitionTo(orgId, 'expired', operatorId, 'License expired');
  }

  /**
   * Get lifecycle history for an organization from audit logs.
   */
  async getHistory(orgId: string) {
    return prisma.systemAuditLog.findMany({
      where: {
        target_tenant_id: orgId,
        action: { startsWith: 'tenant.lifecycle.' },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        User: { select: { id: true, name: true, email: true } },
      },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const tenantLifecycleService = new TenantLifecycleService();
