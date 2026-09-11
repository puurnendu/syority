/**
 * R0.3 — Scope Change ownership / event / workpack proof.
 *
 * A UUID is not authorization. Every referenced Activity and Workpack
 * is resolved server-side against the authenticated tenant and the
 * Scope Change's event. Cross-tenant failures use a generic not-found
 * message so existence in another tenant is not leaked.
 *
 * Does not create a second identity engine. Event agreement follows
 * the R0.1/R0.2 rule: Activity.event_id must agree with Workpack.event_id
 * when both are set.
 */
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { AuditService } from '@/lib/audit';

export const GENERIC_ACTIVITY_NOT_FOUND = 'Referenced activity was not found';
export const GENERIC_WORKPACK_NOT_FOUND = 'Referenced workpack was not found';
export const GENERIC_SCOPE_CHANGE_NOT_FOUND = 'Scope change not found';
export const EVENT_CONTEXT_MISMATCH = 'Activity does not belong to this event';
export const WORKPACK_EVENT_MISMATCH = 'Workpack does not belong to this event';
export const LOOSE_ACTIVITY_NO_CONTEXT =
  'Activity has no event or workpack context and cannot be used in a scope change';
export const ACTIVITY_EVENT_WORKPACK_MISMATCH =
  'Activity event does not agree with its workpack event';
export const REMOVE_ACTIVITY_M12 =
  'Scope Change cannot cancel an Activity. Status cancellation is an M12 execution mutation.';

export type ScopeChangeDb = {
  scheduleScopeChange: {
    findFirst: (args: unknown) => Promise<any>;
  };
  activity: {
    findFirst: (args: unknown) => Promise<any>;
  };
  workpack: {
    findFirst: (args: unknown) => Promise<any>;
  };
  event: {
    findFirst: (args: unknown) => Promise<any>;
  };
};

export class ScopeChangeSecurityError extends AppError {
  public readonly securityCode: string;

  constructor(
    securityCode: string,
    message: string,
    code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'PERMISSION_ERROR' | 'BUSINESS_ERROR' = 'NOT_FOUND'
  ) {
    const status =
      code === 'NOT_FOUND' ? 404
        : code === 'PERMISSION_ERROR' ? 403
          : code === 'BUSINESS_ERROR' ? 422
            : 400;
    super(message, code, status, { securityCode });
    this.securityCode = securityCode;
  }
}

export interface ResolvedActivity {
  id: string;
  organization_id: string;
  event_id: string | null;
  workpack_id: string | null;
  status: string | null;
  progress_percent: number | null;
  actual_start: Date | string | null;
  actual_end: Date | string | null;
}

export interface ResolvedWorkpack {
  id: string;
  organization_id: string;
  event_id: string | null;
  deleted_at: Date | string | null;
}

export interface ScopeChangeContext {
  id: string;
  organization_id: string;
  event_id: string;
  status: string;
  change_number: string;
  title: string;
  discovery_id?: string | null;
  items?: unknown[];
}

export async function loadScopeChange(
  scopeChangeId: string,
  orgId: string,
  eventId?: string | null,
  db: ScopeChangeDb = prisma as unknown as ScopeChangeDb
): Promise<ScopeChangeContext> {
  const sc = await db.scheduleScopeChange.findFirst({
    where: { id: scopeChangeId, organization_id: orgId },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  });
  if (!sc) {
    throw new ScopeChangeSecurityError('SCOPE_CHANGE_NOT_FOUND', GENERIC_SCOPE_CHANGE_NOT_FOUND);
  }
  if (eventId && sc.event_id !== eventId) {
    throw new ScopeChangeSecurityError('SCOPE_CHANGE_NOT_FOUND', GENERIC_SCOPE_CHANGE_NOT_FOUND);
  }
  return sc;
}

export async function assertEventInTenant(
  eventId: string,
  orgId: string,
  db: ScopeChangeDb = prisma as unknown as ScopeChangeDb
) {
  const event = await db.event.findFirst({
    where: { id: eventId, organization_id: orgId },
    select: { id: true, site_id: true, organization_id: true, deleted_at: true },
  });
  if (!event || event.deleted_at) {
    throw new ScopeChangeSecurityError('EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

export async function resolveWorkpackForScopeChange(
  workpackId: string,
  orgId: string,
  eventId: string,
  db: ScopeChangeDb = prisma as unknown as ScopeChangeDb
): Promise<ResolvedWorkpack> {
  const wp = await db.workpack.findFirst({
    where: { id: workpackId },
    select: { id: true, organization_id: true, event_id: true, deleted_at: true },
  });
  if (!wp || wp.deleted_at || wp.organization_id !== orgId) {
    throw new ScopeChangeSecurityError('WORKPACK_NOT_FOUND', GENERIC_WORKPACK_NOT_FOUND);
  }
  if (!wp.event_id || wp.event_id !== eventId) {
    throw new ScopeChangeSecurityError('WORKPACK_EVENT_MISMATCH', WORKPACK_EVENT_MISMATCH, 'VALIDATION_ERROR');
  }
  return wp;
}

export async function resolveActivityForScopeChange(
  activityId: string,
  orgId: string,
  eventId: string,
  db: ScopeChangeDb = prisma as unknown as ScopeChangeDb
): Promise<{ activity: ResolvedActivity; workpack: ResolvedWorkpack | null }> {
  const activity = await db.activity.findFirst({
    where: { id: activityId },
    select: {
      id: true,
      organization_id: true,
      event_id: true,
      workpack_id: true,
      status: true,
      progress_percent: true,
      actual_start: true,
      actual_end: true,
      deleted_at: true,
    },
  });

  if (!activity || activity.deleted_at || activity.organization_id !== orgId) {
    throw new ScopeChangeSecurityError('ACTIVITY_NOT_FOUND', GENERIC_ACTIVITY_NOT_FOUND);
  }

  let workpack: ResolvedWorkpack | null = null;
  if (activity.workpack_id) {
    const wp = await db.workpack.findFirst({
      where: { id: activity.workpack_id },
      select: { id: true, organization_id: true, event_id: true, deleted_at: true },
    });
    if (!wp || wp.deleted_at || wp.organization_id !== orgId) {
      throw new ScopeChangeSecurityError('ACTIVITY_NOT_FOUND', GENERIC_ACTIVITY_NOT_FOUND);
    }
    if (activity.event_id && wp.event_id && activity.event_id !== wp.event_id) {
      throw new ScopeChangeSecurityError(
        'ACTIVITY_EVENT_WORKPACK_MISMATCH',
        ACTIVITY_EVENT_WORKPACK_MISMATCH,
        'VALIDATION_ERROR'
      );
    }
    if (wp.event_id && wp.event_id !== eventId) {
      throw new ScopeChangeSecurityError('EVENT_MISMATCH', EVENT_CONTEXT_MISMATCH, 'VALIDATION_ERROR');
    }
    workpack = wp;
  }

  if (activity.event_id && activity.event_id !== eventId) {
    throw new ScopeChangeSecurityError('EVENT_MISMATCH', EVENT_CONTEXT_MISMATCH, 'VALIDATION_ERROR');
  }

  if (!activity.event_id && !workpack?.event_id) {
    throw new ScopeChangeSecurityError('LOOSE_ACTIVITY', LOOSE_ACTIVITY_NO_CONTEXT, 'VALIDATION_ERROR');
  }

  return { activity, workpack };
}

export async function resolvePredecessorIds(
  predecessorIds: string[] | undefined,
  orgId: string,
  eventId: string,
  db: ScopeChangeDb = prisma as unknown as ScopeChangeDb
) {
  if (!predecessorIds?.length) return;
  for (const id of predecessorIds) {
    await resolveActivityForScopeChange(id, orgId, eventId, db);
  }
}

export async function validateItemReferences(
  orgId: string,
  eventId: string,
  input: {
    item_type?: string;
    activity_id?: string | null;
    workpack_id?: string | null;
    predecessor_ids?: string[];
  },
  db: ScopeChangeDb = prisma as unknown as ScopeChangeDb
) {
  const type = input.item_type ?? 'new_activity';

  if (input.workpack_id) {
    await resolveWorkpackForScopeChange(input.workpack_id, orgId, eventId, db);
  }

  if (type === 'modify_activity' || type === 'remove_activity') {
    if (!input.activity_id) {
      throw new ScopeChangeSecurityError(
        'ACTIVITY_REQUIRED',
        'activity_id is required for this item type',
        'VALIDATION_ERROR'
      );
    }
    await resolveActivityForScopeChange(input.activity_id, orgId, eventId, db);
  } else if (input.activity_id) {
    await resolveActivityForScopeChange(input.activity_id, orgId, eventId, db);
  }

  await resolvePredecessorIds(input.predecessor_ids, orgId, eventId, db);
}

export async function recordSecurityRejection(input: {
  organizationId: string;
  userId?: string | null;
  scopeChangeId: string;
  reason: string;
}) {
  if (!input.userId) return;
  await AuditService.log({
    organization_id: input.organizationId,
    user_id: input.userId,
    action: 'rejected',
    model_name: 'ScheduleScopeChange',
    model_id: input.scopeChangeId,
    new_values: {
      source: 'R0.3_SCOPE_CHANGE_SECURITY',
      result: 'rejected',
      reason: input.reason,
    },
  });
}

export function isScopeChangeSecurityError(error: unknown): error is ScopeChangeSecurityError {
  return error instanceof ScopeChangeSecurityError;
}

export function scopeChangeErrorBody(err: unknown): { error: string; status: number } {
  if (err instanceof AppError) {
    return { error: err.message, status: err.statusCode };
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  const status = /not found/i.test(message) ? 404
    : /cannot/i.test(message) ? 409
    : 500;
  return { error: message, status };
}
