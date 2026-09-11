import { hasPermission } from '@/lib/permissions';
import { normalizeRole } from '@/security/scopes';
import type { ReviewActor } from './types';

export function reviewActorFromSession(session: { user?: any }): ReviewActor {
  const user = session.user ?? {};
  const roles: string[] = [
    ...new Set([
      ...(user.role ? [normalizeRole(user.role)] : []),
      ...((user.roles || []) as string[]).map(normalizeRole),
    ]),
  ];
  const anyPerm = (perm: 'workpacks.view' | 'workpacks.edit' | 'workpacks.approve' | 'events.view') =>
    roles.includes('platform_super_admin') || roles.some((r) => hasPermission(r, perm));

  return {
    userId: user.id,
    organizationId: user.organization_id,
    canViewWorkpacks: anyPerm('workpacks.view'),
    canEditWorkpacks: anyPerm('workpacks.edit'),
    canApproveWorkpacks: anyPerm('workpacks.approve'),
    canViewEvents: anyPerm('events.view'),
  };
}

export function reviewErrorBody(err: unknown): { error: string; status: number; code?: string } {
  if (err && typeof err === 'object' && 'statusCode' in err && 'message' in err) {
    const e = err as { statusCode: number; message: string; details?: { code?: string } };
    return { error: e.message, status: e.statusCode, code: e.details?.code };
  }
  return { error: 'Unexpected error', status: 500 };
}
