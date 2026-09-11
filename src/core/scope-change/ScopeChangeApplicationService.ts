/**
 * M8.11 — ScopeChangeApplicationService
 *
 * Applies approved scope changes by creating Workpacks and Activities
 * in a controlled, audited transaction.
 *
 * R0.3: every referenced Activity / Workpack is ownership-proved against
 * the authenticated tenant and the Scope Change event before mutation.
 * Planning fields only. Execution status is not written here.
 *
 * new_activity is created through ActivityCreationCommand.
 * remove_activity is refused — cancellation is an M12 execution mutation
 * and ExecutionWriteService has no CANCEL action yet.
 *
 * Lifecycle: approved → applying → applied
 */
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { createActivity } from '@/core/activity/ActivityCreationCommand';
import { PlannedDateAuthority } from '@/core/schedule/PlannedDateAuthority';
import {
  REMOVE_ACTIVITY_M12,
  ScopeChangeSecurityError,
  assertEventInTenant,
  loadScopeChange,
  recordSecurityRejection,
  resolveActivityForScopeChange,
  resolveWorkpackForScopeChange,
  validateItemReferences,
} from './ScopeChangeOwnership';

interface ApplicationResult {
  scope_change_id: string;
  change_number: string;
  workpacks_created: string[];
  activities_created: string[];
  activities_modified: string[];
  activities_removed: string[];
  audit_log_id: string;
}

const PLANNING_ONLY = new Set([
  'duration_hours',
  'budgeted_cost',
  'planned_start',
  'planned_end',
  'description',
]);

export class ScopeChangeApplicationService {
  /**
   * Apply an approved scope change — creates workpacks/activities in a transaction.
   * Transitions: approved → applying → applied
   */
  static async apply(
    scopeChangeId: string,
    orgId: string,
    userId: string,
    eventId?: string | null
  ): Promise<ApplicationResult> {
    const sc = await loadScopeChange(scopeChangeId, orgId, eventId);
    if (sc.status !== 'approved') {
      throw new Error(`Cannot apply scope change in '${sc.status}' status. Must be 'approved'.`);
    }

    const event = await assertEventInTenant(sc.event_id, orgId);
    const items = (sc.items ?? []) as Array<{
      item_type: string;
      activity_id: string | null;
      workpack_id: string | null;
      predecessor_ids: string[];
      description: string;
      estimated_hours: number;
      estimated_cost: number;
      planned_start: Date | string | null;
      planned_end: Date | string | null;
      discipline: string | null;
    }>;

    try {
      for (const item of items) {
        await validateItemReferences(orgId, sc.event_id, item);
        if (item.item_type === 'remove_activity') {
          throw new ScopeChangeSecurityError(
            'REMOVE_ACTIVITY_M12',
            REMOVE_ACTIVITY_M12,
            'BUSINESS_ERROR'
          );
        }
      }
    } catch (err) {
      if (err instanceof ScopeChangeSecurityError) {
        await recordSecurityRejection({
          organizationId: orgId,
          userId,
          scopeChangeId,
          reason: err.securityCode,
        });
      }
      throw err;
    }

    const result: ApplicationResult = {
      scope_change_id: sc.id,
      change_number: sc.change_number,
      workpacks_created: [],
      activities_created: [],
      activities_modified: [],
      activities_removed: [],
      audit_log_id: '',
    };

    await prisma.$transaction(async (tx) => {
      await tx.scheduleScopeChange.update({
        where: { id: scopeChangeId },
        data: { status: 'applying', applied_by: userId },
      });

      let resultWorkpackId: string | null = null;

      for (const item of items) {
        await validateItemReferences(orgId, sc.event_id, item, tx as any);

        switch (item.item_type) {
          case 'new_workpack': {
            const wpId = randomUUID();
            await tx.workpack.create({
              data: {
                id: wpId,
                organization_id: orgId,
                site_id: event.site_id,
                event_id: sc.event_id,
                title: item.description,
                workpack_number: `SC-${sc.change_number}-WP`,
                status: 'draft',
                approval_status: 'pending',
                created_by: userId,
              },
            });
            result.workpacks_created.push(wpId);
            resultWorkpackId = wpId;
            break;
          }

          case 'new_activity': {
            if (item.workpack_id) {
              await resolveWorkpackForScopeChange(item.workpack_id, orgId, sc.event_id, tx as any);
            }

            let targetWorkpackId = item.workpack_id ?? resultWorkpackId;

            if (!targetWorkpackId) {
              const autoWpId = randomUUID();
              await tx.workpack.create({
                data: {
                  id: autoWpId,
                  organization_id: orgId,
                  site_id: event.site_id,
                  event_id: sc.event_id,
                  title: `${sc.change_number} — Scope Change Work`,
                  workpack_number: `SC-${sc.change_number}`,
                  status: 'draft',
                  approval_status: 'pending',
                  created_by: userId,
                },
              });
              result.workpacks_created.push(autoWpId);
              resultWorkpackId = autoWpId;
              targetWorkpackId = autoWpId;
            }

            const created = await createActivity(
              {
                organizationId: orgId,
                userId,
                sourceChannel: 'api',
                eventId: sc.event_id,
              },
              {
                workpackId: targetWorkpackId,
                description: item.description,
                durationHours: item.estimated_hours,
                discipline: item.discipline,
              },
              tx
            );
            result.activities_created.push(created.id);
            if (item.planned_start || item.planned_end) {
              await PlannedDateAuthority.applyOverride({
                organizationId: orgId,
                activityId: created.id,
                userId,
                reason: `Scope change ${sc.change_number || sc.id}`,
                source: 'scope_change',
                planned_start: item.planned_start,
                planned_end: item.planned_end,
              }, tx);
            }
            break;
          }

          case 'modify_activity': {
            if (!item.activity_id) break;
            await resolveActivityForScopeChange(item.activity_id, orgId, sc.event_id, tx as any);

            const updateData: Record<string, unknown> = {};
            if (item.estimated_hours > 0) updateData.duration_hours = item.estimated_hours;
            if (item.estimated_cost > 0) updateData.budgeted_cost = item.estimated_cost;
            if (item.description) updateData.description = item.description;

            for (const key of Object.keys(updateData)) {
              if (!PLANNING_ONLY.has(key)) {
                throw new ScopeChangeSecurityError(
                  'EXECUTION_FIELD_REJECTED',
                  'Scope Change cannot write execution fields.',
                  'BUSINESS_ERROR'
                );
              }
            }

            if (Object.keys(updateData).length > 0) {
              const updated = await tx.activity.updateMany({
                where: {
                  id: item.activity_id,
                  organization_id: orgId,
                  deleted_at: null,
                },
                data: updateData,
              });
              if (updated.count !== 1) {
                throw new ScopeChangeSecurityError(
                  'ACTIVITY_NOT_FOUND',
                  'Referenced activity was not found'
                );
              }
            }

            if (item.planned_start || item.planned_end) {
              await PlannedDateAuthority.applyOverride({
                organizationId: orgId,
                activityId: item.activity_id,
                userId,
                reason: `Scope change ${sc.change_number || sc.id}`,
                source: 'scope_change',
                planned_start: item.planned_start,
                planned_end: item.planned_end,
              }, tx);
            }
            result.activities_modified.push(item.activity_id);
            break;
          }

          case 'remove_activity': {
            throw new ScopeChangeSecurityError(
              'REMOVE_ACTIVITY_M12',
              REMOVE_ACTIVITY_M12,
              'BUSINESS_ERROR'
            );
          }
        }
      }

      const auditId = randomUUID();
      await tx.auditLog.create({
        data: {
          id: auditId,
          organization_id: orgId,
          auditable_type: 'SCOPE_CHANGE',
          auditable_id: sc.id,
          event: 'SCOPE_CHANGE_APPLIED',
          user_id: userId,
          new_values: {
            change_number: sc.change_number,
            title: sc.title,
            workpacks_created: result.workpacks_created.length,
            activities_created: result.activities_created.length,
            activities_modified: result.activities_modified.length,
            activities_removed: result.activities_removed.length,
            source: 'R0.3_SCOPE_CHANGE_SECURITY',
          },
        },
      });
      result.audit_log_id = auditId;

      await tx.scheduleScopeChange.update({
        where: { id: scopeChangeId },
        data: {
          status: 'applied',
          applied_at: new Date(),
          result_workpack_id: resultWorkpackId,
          result_summary: {
            workpacks_created: result.workpacks_created,
            activities_created: result.activities_created,
            activities_modified: result.activities_modified,
            activities_removed: result.activities_removed,
          },
        },
      });

      if (sc.discovery_id) {
        await tx.discoveryWork.update({
          where: { id: sc.discovery_id },
          data: { status: 'closed' },
        });
      }
    });

    return result;
  }
}
