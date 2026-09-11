/**
 * Sprint 1b — M11 is the authority for Activity.planned_start / planned_end.
 *
 * planned_* is the EFFECTIVE display value:
 *   - CPM derivation (early_start / early_finish) when no override is active
 *   - the planner's audited pin when planned_*_override is set
 *
 * planned_derived_* always holds the latest CPM value so an override never
 * destroys the derived truth (audit §7.6 TYPE 5, roadmap item 10).
 */

import { prisma } from '@/lib/prisma';
import type { PrismaTransactionClient } from '@/lib/prismaTypes';
import { AuditService } from '@/lib/audit';
import type { CalculatedActivity } from '@/lib/scheduleEngine';
import {
  PlannedDateAuthorityError,
  PLANNED_DATE_REJECT_MESSAGE,
} from './plannedDateGuard';

export interface CpmPersistFields {
  hoursPerDay: number;
}

export interface PlannedDateOverrideInput {
  organizationId: string;
  activityId: string;
  userId: string;
  reason: string;
  planned_start?: Date | string | null;
  planned_end?: Date | string | null;
  /** Optional source label stored in the reason prefix, e.g. 'resource_leveling'. */
  source?: string;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function requireReason(reason: string): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new PlannedDateAuthorityError(
      'An override reason is required to set a planned date that CPM did not derive.'
    );
  }
  return trimmed;
}

export class PlannedDateAuthority {
  /**
   * Persist CPM-native columns AND the authoritative planned dates.
   * Active overrides keep planned_* pinned; derived columns still update.
   */
  static async persistCpmResults(
    orgId: string,
    calculated: CalculatedActivity[],
    fields: CpmPersistFields,
    db: PrismaTransactionClient = prisma
  ): Promise<void> {
    if (calculated.length === 0) return;

    const ids = calculated.map((a) => a.id);
    const current = await db.activity.findMany({
      where: { id: { in: ids }, organization_id: orgId },
      select: {
        id: true,
        planned_start_override: true,
        planned_end_override: true,
      },
    });
    const overrideById = new Map(current.map((row) => [row.id, row]));

    await prisma.$transaction(
      calculated.map((act) => {
        const derivedStart = act.early_start ? new Date(act.early_start) : null;
        const derivedEnd = act.early_finish ? new Date(act.early_finish) : null;
        const ov = overrideById.get(act.id);
        const startPinned = ov?.planned_start_override != null;
        const endPinned = ov?.planned_end_override != null;

        return prisma.activity.update({
          where: { id: act.id },
          data: {
            early_start: derivedStart,
            early_finish: derivedEnd,
            late_start: act.late_start ? new Date(act.late_start) : null,
            late_finish: act.late_finish ? new Date(act.late_finish) : null,
            total_float: act.total_float_hours,
            free_float: act.free_float_days * fields.hoursPerDay,
            is_critical: act.is_critical,
            planned_derived_start: derivedStart,
            planned_derived_end: derivedEnd,
            ...(!startPinned ? { planned_start: derivedStart } : {}),
            ...(!endPinned ? { planned_end: derivedEnd } : {}),
          },
        });
      })
    );
  }

  /**
   * Planner (or an approved business process) pins a date CPM disagrees with.
   * The current CPM-derived value is preserved in planned_derived_*.
   */
  static async applyOverride(
    input: PlannedDateOverrideInput,
    db: PrismaTransactionClient = prisma
  ) {
    const reason = requireReason(input.reason);
    const start = input.planned_start !== undefined ? asDate(input.planned_start) : undefined;
    const end = input.planned_end !== undefined ? asDate(input.planned_end) : undefined;
    if (start === undefined && end === undefined) {
      throw new PlannedDateAuthorityError('Override must include planned_start and/or planned_end.');
    }

    const existing = await db.activity.findFirst({
      where: {
        id: input.activityId,
        organization_id: input.organizationId,
        deleted_at: null,
      },
    });
    if (!existing) {
      throw new PlannedDateAuthorityError('Activity not found or access denied.');
    }

    const recordedReason = input.source ? `[${input.source}] ${reason}` : reason;
    const now = new Date();

    const data: Record<string, unknown> = {
      planned_override_reason: recordedReason,
      planned_override_by: input.userId,
      planned_override_at: now,
      updated_by: input.userId,
    };

    if (start !== undefined) {
      data.planned_start_override = start;
      data.planned_start = start;
      if (existing.planned_derived_start == null && existing.early_start) {
        data.planned_derived_start = existing.early_start;
      }
    }
    if (end !== undefined) {
      data.planned_end_override = end;
      data.planned_end = end;
      if (existing.planned_derived_end == null && existing.early_finish) {
        data.planned_derived_end = existing.early_finish;
      }
    }

    const updated = await db.activity.update({
      where: { id: input.activityId },
      data,
    });

    await AuditService.log({
      organization_id: input.organizationId,
      user_id: input.userId,
      action: 'planned_date_override',
      model_name: 'Activity',
      model_id: input.activityId,
      old_values: {
        planned_start: existing.planned_start,
        planned_end: existing.planned_end,
        planned_derived_start: existing.planned_derived_start,
        planned_derived_end: existing.planned_derived_end,
      },
      new_values: {
        planned_start: updated.planned_start,
        planned_end: updated.planned_end,
        planned_start_override: updated.planned_start_override,
        planned_end_override: updated.planned_end_override,
        planned_derived_start: updated.planned_derived_start,
        planned_derived_end: updated.planned_derived_end,
        planned_override_reason: recordedReason,
      },
      site_id: existing.site_id ?? undefined,
    }, db);

    return updated;
  }

  /** Drop the pin and restore the effective planned dates from the last CPM derivation. */
  static async clearOverride(
    organizationId: string,
    activityId: string,
    userId: string,
    db: PrismaTransactionClient = prisma
  ) {
    const existing = await db.activity.findFirst({
      where: { id: activityId, organization_id: organizationId, deleted_at: null },
    });
    if (!existing) {
      throw new PlannedDateAuthorityError('Activity not found or access denied.');
    }

    const updated = await db.activity.update({
      where: { id: activityId },
      data: {
        planned_start: existing.planned_derived_start,
        planned_end: existing.planned_derived_end,
        planned_start_override: null,
        planned_end_override: null,
        planned_override_reason: null,
        planned_override_by: null,
        planned_override_at: null,
        updated_by: userId,
      },
    });

    await AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'planned_date_override_cleared',
      model_name: 'Activity',
      model_id: activityId,
      old_values: {
        planned_start_override: existing.planned_start_override,
        planned_end_override: existing.planned_end_override,
        planned_override_reason: existing.planned_override_reason,
      },
      new_values: {
        planned_start: updated.planned_start,
        planned_end: updated.planned_end,
      },
      site_id: existing.site_id ?? undefined,
    }, db);

    return updated;
  }

  static rejectMessage(): string {
    return PLANNED_DATE_REJECT_MESSAGE;
  }
}
