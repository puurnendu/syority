/**
 * R0.4-D — controlled Workpack Event review.
 * Human confirmation required. No Project→Event. No Activity rewrite.
 */
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { AppError, BusinessError, PermissionError, ValidationError } from '@/lib/errors';
import { EventPlanningService } from '@/core/planning/EventPlanningService';
import {
  GENERIC_EVENT_NOT_FOUND,
  GENERIC_WORKPACK_NOT_FOUND,
  REVIEW_SOURCE,
  type ChildMismatch,
  type Classification,
  type ReviewActor,
  type ReviewDecision,
  type ReviewPermissions,
} from './types';
import {
  classifyEvidence,
  displayReviewState,
  reviewPriority,
  type LinkedEvent,
} from './WorkpackIdentityEvidence';

const NOT_FOUND = new AppError(GENERIC_WORKPACK_NOT_FOUND, 'NOT_FOUND', 404);

function asLinked(
  ev: {
    id: string;
    code: string;
    name: string;
    status: string;
    planned_start: Date | null;
    planned_end: Date | null;
    organization_id: string;
    site?: { name: string } | null;
  } | null,
  orgId: string
): LinkedEvent | null {
  if (!ev) return null;
  return {
    eventId: ev.id,
    code: ev.code,
    name: ev.name,
    siteName: ev.site?.name ?? null,
    plannedStart: ev.planned_start,
    plannedEnd: ev.planned_end,
    status: ev.status,
    orgMatch: ev.organization_id === orgId,
  };
}

export class WorkpackIdentityReviewService {
  static permissionsFor(actor: ReviewActor, classification: Classification): ReviewPermissions {
    return {
      canAssign:
        actor.canEditWorkpacks &&
        actor.canViewEvents &&
        classification !== 'CONFLICTING_CHILD_EVENT',
      canQuarantine: actor.canApproveWorkpacks,
      canResolveConflict:
        actor.canEditWorkpacks &&
        actor.canApproveWorkpacks &&
        classification === 'CONFLICTING_CHILD_EVENT',
      canRollback: actor.canApproveWorkpacks,
    };
  }

  static async listOrgEvents(actor: ReviewActor) {
    if (!actor.canViewEvents || !actor.canViewWorkpacks) {
      throw new PermissionError('You do not have permission to review Events');
    }
    const events = await EventPlanningService.list(actor.organizationId);
    return events.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      status: e.status,
      planned_start: e.planned_start,
      planned_end: e.planned_end,
      site_name: e.site?.name ?? null,
    }));
  }

  static async listQueue(
    actor: ReviewActor,
    filters: {
      classification?: string;
      review_state?: string;
      site_id?: string;
      status?: string;
      work_type?: string;
      priority?: string;
    } = {}
  ) {
    if (!actor.canViewWorkpacks || !actor.canViewEvents) {
      throw new PermissionError('You do not have permission to view the Event review queue');
    }

    const workpacks = await prisma.workpack.findMany({
      where: {
        organization_id: actor.organizationId,
        event_id: null,
        deleted_at: null,
        ...(filters.site_id ? { site_id: filters.site_id } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.work_type ? { work_type: filters.work_type } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
      },
      include: {
        organization: { select: { name: true } },
        site: { select: { name: true } },
        unit: { select: { code: true, name: true } },
        system: { select: { code: true, name: true } },
        asset: { select: { tag_number: true, name: true } },
        discipline: { select: { name: true } },
        identity_review: true,
      },
      orderBy: [{ created_at: 'asc' }],
    });

    const ids = workpacks.map((w) => w.id);
    const evidenceByWp = await this.loadEvidenceMap(actor.organizationId, ids);

    const rows = workpacks.map((w) => {
      const classified = classifyEvidence(evidenceByWp.get(w.id)!);
      if (filters.classification && classified.classification !== filters.classification) {
        return null;
      }
      const reviewState = displayReviewState(w.identity_review?.review_state, classified.classification);
      if (filters.review_state && reviewState !== filters.review_state) return null;
      const primary = classified.candidates.length === 1 ? classified.candidates[0] : null;
      return {
        id: w.id,
        workpack_number: w.workpack_number,
        title: w.title,
        organization_name: w.organization?.name ?? null,
        site_name: w.site?.name ?? null,
        status: w.status,
        work_type: w.work_type,
        equipment: w.asset?.tag_number ?? w.equipment_type ?? null,
        unit: w.unit?.code ?? w.unit_code ?? null,
        system: w.system?.code ?? null,
        discipline: w.discipline?.name ?? null,
        planned_start_date: w.planned_start_date,
        planned_end_date: w.planned_end_date,
        classification: classified.classification,
        candidate_event: primary ? `${primary.code} — ${primary.name}` : classified.candidates.length > 1 ? 'Multiple' : 'None',
        review_state: reviewState,
        priority: reviewPriority(classified.classification),
        version: w.identity_review?.version ?? 0,
      };
    });

    const list = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    list.sort((a, b) => a.priority.localeCompare(b.priority) || (a.title || '').localeCompare(b.title || ''));
    return list;
  }

  static async getDetail(actor: ReviewActor, workpackId: string) {
    if (!actor.canViewWorkpacks || !actor.canViewEvents) {
      throw new PermissionError('You do not have permission to view Event review');
    }

    const workpack = await prisma.workpack.findFirst({
      where: {
        id: workpackId,
        organization_id: actor.organizationId,
        deleted_at: null,
      },
      include: {
        organization: { select: { name: true } },
        site: { select: { name: true } },
        plant: { select: { name: true } },
        unit: { select: { code: true, name: true } },
        system: { select: { code: true, name: true } },
        asset: { select: { tag_number: true, name: true } },
        discipline: { select: { name: true } },
        contractor: { select: { name: true } },
        User_Workpack_created_byToUser: { select: { name: true, email: true } },
        identity_review: true,
      },
    });
    if (!workpack) throw NOT_FOUND;

    const evidenceMap = await this.loadEvidenceMap(actor.organizationId, [workpack.id]);
    const classified = classifyEvidence(evidenceMap.get(workpack.id)!);
    const reviewState = displayReviewState(workpack.identity_review?.review_state, classified.classification);
    const perms = this.permissionsFor(actor, classified.classification);

    const identity: Record<string, unknown> = {};
    const put = (label: string, value: unknown) => {
      if (value !== null && value !== undefined && value !== '') identity[label] = value;
    };
    put('Workpack Number', workpack.workpack_number);
    put('Code', workpack.workpack_id_code);
    put('Title', workpack.title);
    put('Scope of Work', workpack.scope_of_work);
    put('Status', workpack.status);
    put('Work Type', workpack.work_type);
    put('Job Type', workpack.job_type);
    put('Priority', workpack.priority);
    put('Organisation', workpack.organization?.name);
    put('Site', workpack.site?.name);
    put('Plant', workpack.plant?.name);
    put('Unit', workpack.unit?.name || workpack.unit?.code || workpack.unit_code);
    put('System', workpack.system?.name || workpack.system?.code);
    put('Equipment', workpack.asset ? `${workpack.asset.tag_number} ${workpack.asset.name}` : workpack.equipment_type);
    put('Discipline', workpack.discipline?.name);
    put('Contractor', workpack.contractor?.name);
    put('Planned Start', workpack.planned_start_date);
    put('Planned Finish', workpack.planned_end_date);
    put('Created By', workpack.User_Workpack_created_byToUser?.name || workpack.User_Workpack_created_byToUser?.email);
    put('Created At', workpack.created_at);
    put('Updated At', workpack.updated_at);
    put('SAP Work Order', workpack.sap_work_order);
    put('SAP Notification', workpack.sap_notification);
    put('Template', workpack.template_id);

    const audits = await prisma.auditLog.findMany({
      where: {
        organization_id: actor.organizationId,
        auditable_id: workpack.id,
        auditable_type: { in: ['Workpack', 'WorkpackIdentityReview'] },
      },
      orderBy: { created_at: 'desc' },
      take: 40,
    });
    const history = audits
      .filter((a) => {
        const nv = (a.new_values ?? {}) as Record<string, unknown>;
        return nv.source === REVIEW_SOURCE;
      })
      .map((a) => {
        const nv = (a.new_values ?? {}) as Record<string, unknown>;
        return {
          event: a.event,
          decision: nv.decision,
          reason: nv.reason,
          when: a.created_at,
          who: a.user_id,
          new_event_id: nv.new_event_id,
        };
      });

    return {
      workpack_id: workpack.id,
      event_id: workpack.event_id,
      classification: classified.classification,
      category: classified.category,
      review_state: reviewState,
      version: workpack.identity_review?.version ?? 0,
      priority: reviewPriority(classified.classification),
      identity,
      paths: classified.paths,
      candidates: classified.candidates,
      conflicting_event_ids: classified.conflictingEventIds,
      permissions: perms,
      history,
      assign_blocked: classified.classification === 'CONFLICTING_CHILD_EVENT',
    };
  }

  static async apply(
    actor: ReviewActor,
    workpackId: string,
    input: {
      decision: ReviewDecision;
      confirm?: boolean;
      eventId?: string | null;
      reason?: string;
      evidence?: string;
      expected_version?: number;
      conflict_resolution?: boolean;
      approver_id?: string;
      project_id?: unknown;
      projectId?: unknown;
    }
  ) {
    if (input.project_id != null || input.projectId != null) {
      throw new ValidationError('Project is not an Event identity source');
    }

    const workpack = await prisma.workpack.findFirst({
      where: { id: workpackId, organization_id: actor.organizationId, deleted_at: null },
      include: { identity_review: true },
    });
    if (!workpack) throw NOT_FOUND;

    const evidenceMap = await this.loadEvidenceMap(actor.organizationId, [workpack.id]);
    const classified = classifyEvidence(evidenceMap.get(workpack.id)!);
    const currentVersion = workpack.identity_review?.version ?? 0;
    const expected = input.expected_version ?? 0;
    if (currentVersion !== expected) {
      throw new AppError('Review state changed', 'BUSINESS_ERROR', 409, { code: 'REVIEW_STATE_CHANGED' });
    }

    const perms = this.permissionsFor(actor, classified.classification);

    if (input.decision === 'ASSIGN') {
      return this.applyAssign(actor, workpack, classified, input, perms);
    }
    if (input.decision === 'QUARANTINE') {
      if (!perms.canQuarantine) throw new PermissionError('Quarantine requires approval permission');
      return this.applyDisposition(actor, workpack, classified, 'QUARANTINED', input);
    }
    if (input.decision === 'DEFER') {
      if (!actor.canEditWorkpacks) throw new PermissionError('You do not have permission to defer review');
      return this.applyDisposition(actor, workpack, classified, 'DEFERRED', input);
    }
    if (input.decision === 'REJECT') {
      if (!actor.canEditWorkpacks) throw new PermissionError('You do not have permission to reject a candidate');
      return this.applyDisposition(actor, workpack, classified, 'REJECTED', input);
    }
    if (input.decision === 'ROLLBACK') {
      if (!perms.canRollback) throw new PermissionError('Rollback requires approval permission');
      return this.applyRollback(actor, workpack, classified, input);
    }
    throw new ValidationError('Unknown review decision');
  }

  private static async applyAssign(
    actor: ReviewActor,
    workpack: {
      id: string;
      organization_id: string;
      site_id: string;
      event_id: string | null;
      scope_item_id: string | null;
      identity_review: { version: number; review_state: string } | null;
    },
    classified: ReturnType<typeof classifyEvidence>,
    input: {
      confirm?: boolean;
      eventId?: string | null;
      reason?: string;
      evidence?: string;
      conflict_resolution?: boolean;
      approver_id?: string;
    },
    perms: ReviewPermissions
  ) {
    if (!input.confirm) {
      return {
        applied: false,
        workpack_id: workpack.id,
        event_id: workpack.event_id,
        reason: 'Human confirmation is required',
      };
    }
    if (!input.eventId) throw new ValidationError('An Event must be selected');
    if (!input.reason?.trim()) throw new ValidationError('Reason is required');
    if (!input.evidence?.trim()) throw new ValidationError('Evidence is required');

    if (classified.classification === 'CONFLICTING_CHILD_EVENT') {
      if (!perms.canResolveConflict) {
        throw new PermissionError('Identity conflict requires approval permission');
      }
      if (!input.conflict_resolution) {
        throw new BusinessError('Conflict resolution is required before Event assignment');
      }
      if (!input.approver_id && !actor.canApproveWorkpacks) {
        throw new ValidationError('Approver is required for identity conflict resolution');
      }
      input.approver_id = input.approver_id || actor.userId;
    } else if (!perms.canAssign) {
      throw new PermissionError('You do not have permission to assign an Event');
    }

    const event = await prisma.event.findFirst({
      where: {
        id: input.eventId,
        organization_id: actor.organizationId,
        deleted_at: null,
      },
      select: { id: true, organization_id: true, code: true, name: true },
    });
    if (!event) {
      throw new AppError(GENERIC_EVENT_NOT_FOUND, 'NOT_FOUND', 404);
    }
    if (event.organization_id !== workpack.organization_id) {
      throw new AppError(GENERIC_EVENT_NOT_FOUND, 'NOT_FOUND', 404);
    }

    if (workpack.scope_item_id) {
      const scopeEvent = await this.scopeEventForItem(workpack.scope_item_id, actor.organizationId);
      if (scopeEvent && scopeEvent !== event.id) {
        throw new BusinessError('Assignment is not allowed because the scope Event conflicts', {
          code: 'SCOPE_EVENT_MISMATCH',
        });
      }
    }

    if (workpack.event_id && workpack.event_id !== event.id) {
      throw new AppError('Review state changed', 'BUSINESS_ERROR', 409, { code: 'REVIEW_STATE_CHANGED' });
    }

    const previous = workpack.event_id;
    const nextVersion = (workpack.identity_review?.version ?? 0) + 1;
    const reviewId = randomUUID();

    await prisma.$transaction(async (tx) => {
      const updated = await tx.workpack.updateMany({
        where: {
          id: workpack.id,
          organization_id: actor.organizationId,
          event_id: previous,
          deleted_at: null,
        },
        data: { event_id: event.id, updated_by: actor.userId },
      });
      if (updated.count !== 1) {
        throw new AppError('Review state changed', 'BUSINESS_ERROR', 409, { code: 'REVIEW_STATE_CHANGED' });
      }

      await tx.workpackIdentityReview.upsert({
        where: { workpack_id: workpack.id },
        create: {
          id: reviewId,
          organization_id: actor.organizationId,
          workpack_id: workpack.id,
          review_state: 'APPLIED',
          classification: classified.classification,
          confirmed_event_id: event.id,
          previous_event_id: previous,
          reason: input.reason,
          evidence: {
            text: input.evidence,
            paths: classified.paths,
            candidates: classified.candidates,
          },
          reviewer_id: actor.userId,
          approver_id: input.approver_id ?? actor.userId,
          conflict_accepted: !!input.conflict_resolution,
          version: nextVersion,
        },
        update: {
          review_state: 'APPLIED',
          classification: classified.classification,
          confirmed_event_id: event.id,
          previous_event_id: previous,
          reason: input.reason,
          evidence: {
            text: input.evidence,
            paths: classified.paths,
            candidates: classified.candidates,
          },
          reviewer_id: actor.userId,
          approver_id: input.approver_id ?? actor.userId,
          conflict_accepted: !!input.conflict_resolution,
          version: nextVersion,
        },
      });

      await AuditService.log(
        {
          organization_id: actor.organizationId,
          user_id: actor.userId,
          action: 'identity_assigned',
          model_name: 'Workpack',
          model_id: workpack.id,
          site_id: workpack.site_id,
          old_values: { event_id: previous },
          new_values: {
            source: REVIEW_SOURCE,
            decision: 'ASSIGN',
            workpack_id: workpack.id,
            previous_event_id: previous,
            new_event_id: event.id,
            organization_id: actor.organizationId,
            reviewer_id: actor.userId,
            approver_id: input.approver_id ?? actor.userId,
            reason: input.reason,
            evidence: input.evidence,
            conflict_type:
              classified.classification === 'CONFLICTING_CHILD_EVENT' ? 'CONFLICTING_CHILD_EVENT' : null,
            conflicting_event_ids: classified.conflictingEventIds,
            resolution_reason: input.conflict_resolution ? input.reason : null,
          },
        },
        tx as any
      );
    });

    const mismatches = await this.childMismatches(workpack.id, actor.organizationId, event.id);
    return {
      applied: true,
      workpack_id: workpack.id,
      event_id: event.id,
      event_code: event.code,
      organization_match: event.organization_id === workpack.organization_id,
      child_mismatches: mismatches,
      activity_event_still_missing: mismatches.filter((m) => !m.activityEventId).length,
      execution_identity_exceptions: mismatches.filter(
        (m) => m.activityEventId && m.activityEventId !== event.id
      ).length,
    };
  }

  private static async applyDisposition(
    actor: ReviewActor,
    workpack: {
      id: string;
      organization_id: string;
      site_id: string;
      event_id: string | null;
      identity_review: { version: number } | null;
    },
    classified: ReturnType<typeof classifyEvidence>,
    state: 'QUARANTINED' | 'DEFERRED' | 'REJECTED',
    input: { reason?: string; evidence?: string }
  ) {
    if (!input.reason?.trim()) throw new ValidationError('Reason is required');
    const nextVersion = (workpack.identity_review?.version ?? 0) + 1;

    await prisma.$transaction(async (tx) => {
      await tx.workpackIdentityReview.upsert({
        where: { workpack_id: workpack.id },
        create: {
          id: randomUUID(),
          organization_id: actor.organizationId,
          workpack_id: workpack.id,
          review_state: state,
          classification: classified.classification,
          reason: input.reason,
          evidence: { text: input.evidence ?? input.reason, paths: classified.paths },
          reviewer_id: actor.userId,
          approver_id: actor.userId,
          version: nextVersion,
        },
        update: {
          review_state: state,
          classification: classified.classification,
          reason: input.reason,
          evidence: { text: input.evidence ?? input.reason, paths: classified.paths },
          reviewer_id: actor.userId,
          approver_id: actor.userId,
          version: nextVersion,
        },
      });

      const still = await tx.workpack.findFirst({
        where: { id: workpack.id, organization_id: actor.organizationId },
        select: { deleted_at: true },
      });
      if (still?.deleted_at) {
        throw new BusinessError('Workpack must not be deleted as a quarantine action');
      }

      await AuditService.log(
        {
          organization_id: actor.organizationId,
          user_id: actor.userId,
          action: state === 'QUARANTINED' ? 'identity_quarantined' : `identity_${state.toLowerCase()}`,
          model_name: 'WorkpackIdentityReview',
          model_id: workpack.id,
          site_id: workpack.site_id,
          old_values: { event_id: workpack.event_id },
          new_values: {
            source: REVIEW_SOURCE,
            decision: state === 'QUARANTINED' ? 'QUARANTINE' : state,
            workpack_id: workpack.id,
            organization_id: actor.organizationId,
            reviewer_id: actor.userId,
            approver_id: actor.userId,
            reason: input.reason,
            evidence: input.evidence ?? input.reason,
            new_event_id: null,
            previous_event_id: workpack.event_id,
          },
        },
        tx as any
      );
    });

    const after = await prisma.workpack.findFirst({
      where: { id: workpack.id, organization_id: actor.organizationId },
      select: { event_id: true, deleted_at: true },
    });

    return {
      applied: false,
      review_state: state,
      workpack_id: workpack.id,
      event_id: after?.event_id ?? null,
      deleted: !!after?.deleted_at,
    };
  }

  private static async applyRollback(
    actor: ReviewActor,
    workpack: {
      id: string;
      organization_id: string;
      site_id: string;
      event_id: string | null;
      identity_review: { version: number; previous_event_id: string | null; review_state: string } | null;
    },
    classified: ReturnType<typeof classifyEvidence>,
    input: { reason?: string; expected_version?: number }
  ) {
    if (!input.reason?.trim()) throw new ValidationError('Reason is required');
    if (!workpack.identity_review || workpack.identity_review.review_state !== 'APPLIED') {
      throw new BusinessError('Only an applied Event assignment can be rolled back');
    }
    const currentEvent = workpack.event_id;
    const restoreTo = workpack.identity_review.previous_event_id;
    const nextVersion = workpack.identity_review.version + 1;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.workpack.updateMany({
        where: {
          id: workpack.id,
          organization_id: actor.organizationId,
          event_id: currentEvent,
          deleted_at: null,
        },
        data: { event_id: restoreTo, updated_by: actor.userId },
      });
      if (updated.count !== 1) {
        throw new AppError('Review state changed', 'BUSINESS_ERROR', 409, { code: 'REVIEW_STATE_CHANGED' });
      }

      await tx.workpackIdentityReview.update({
        where: { workpack_id: workpack.id },
        data: {
          review_state: restoreTo ? 'APPLIED' : 'UNREVIEWED',
          confirmed_event_id: restoreTo,
          previous_event_id: currentEvent,
          reason: input.reason,
          reviewer_id: actor.userId,
          version: nextVersion,
        },
      });

      await AuditService.log(
        {
          organization_id: actor.organizationId,
          user_id: actor.userId,
          action: 'HUMAN_ROLLBACK',
          model_name: 'Workpack',
          model_id: workpack.id,
          site_id: workpack.site_id,
          old_values: { event_id: currentEvent },
          new_values: {
            source: REVIEW_SOURCE,
            decision: 'ROLLBACK',
            workpack_id: workpack.id,
            previous_event: currentEvent,
            restored_event: restoreTo,
            reason: input.reason,
            reviewer_id: actor.userId,
            organization_id: actor.organizationId,
          },
        },
        tx as any
      );
    });

    return {
      applied: false,
      rolled_back: true,
      workpack_id: workpack.id,
      event_id: restoreTo,
    };
  }

  static async childMismatches(
    workpackId: string,
    organizationId: string,
    workpackEventId: string
  ): Promise<ChildMismatch[]> {
    const activities = await prisma.activity.findMany({
      where: { workpack_id: workpackId, organization_id: organizationId, deleted_at: null },
      select: {
        id: true,
        activity_number: true,
        description: true,
        event_id: true,
      },
    });
    const eventIds = [...new Set(activities.map((a) => a.event_id).filter(Boolean))] as string[];
    const events =
      eventIds.length === 0
        ? []
        : await prisma.event.findMany({
            where: { id: { in: eventIds }, organization_id: organizationId },
            select: { id: true, code: true },
          });
    const codeById = new Map(events.map((e) => [e.id, e.code]));

    return activities
      .filter((a) => a.event_id !== workpackEventId)
      .map((a) => ({
        activityId: a.id,
        activityLabel: a.activity_number || a.description,
        activityEventId: a.event_id,
        activityEventCode: a.event_id ? codeById.get(a.event_id) ?? null : null,
        workpackEventId,
      }));
  }

  private static async scopeEventForItem(scopeItemId: string, orgId: string): Promise<string | null> {
    const item = await prisma.scopeItem.findFirst({
      where: { id: scopeItemId, organization_id: orgId },
      select: { scope: { select: { event_id: true, organization_id: true } } },
    });
    if (!item?.scope || item.scope.organization_id !== orgId) return null;
    return item.scope.event_id;
  }

  private static async loadEvidenceMap(orgId: string, workpackIds: string[]) {
    const empty = (): import('./WorkpackIdentityEvidence').EvidenceInput => ({
      title: '',
      workpackNumber: null,
      scopeItemEvents: [],
      instantiationEvents: [],
      activityEvents: [],
      baselineEvents: [],
      unitEvents: [],
      systemEvents: [],
      assetScopeEvents: [],
    });

    const map = new Map<string, ReturnType<typeof empty>>();
    if (workpackIds.length === 0) return map;

    const workpacks = await prisma.workpack.findMany({
      where: { id: { in: workpackIds }, organization_id: orgId },
      select: {
        id: true,
        title: true,
        workpack_number: true,
        scope_item_id: true,
        unit_id: true,
        system_id: true,
        asset_id: true,
      },
    });
    for (const w of workpacks) {
      const row = empty();
      row.title = w.title;
      row.workpackNumber = w.workpack_number;
      map.set(w.id, row);
    }

    const eventSelect = {
      id: true,
      code: true,
      name: true,
      status: true,
      planned_start: true,
      planned_end: true,
      organization_id: true,
      site: { select: { name: true } },
    } as const;

    const scopeIds = workpacks.map((w) => w.scope_item_id).filter(Boolean) as string[];
    if (scopeIds.length) {
      const items = await prisma.scopeItem.findMany({
        where: { id: { in: scopeIds }, organization_id: orgId },
        select: {
          id: true,
          workpack_id: true,
          scope: { select: { event: { select: eventSelect } } },
        },
      });
      for (const w of workpacks) {
        const item = items.find((i) => i.id === w.scope_item_id);
        const linked = asLinked(item?.scope?.event ?? null, orgId);
        if (linked) map.get(w.id)!.scopeItemEvents.push(linked);
      }
    }

    const reverseItems = await prisma.scopeItem.findMany({
      where: { workpack_id: { in: workpackIds }, organization_id: orgId },
      select: {
        workpack_id: true,
        scope: { select: { event: { select: eventSelect } } },
      },
    });
    for (const item of reverseItems) {
      if (!item.workpack_id) continue;
      const linked = asLinked(item.scope?.event ?? null, orgId);
      if (linked) map.get(item.workpack_id)?.scopeItemEvents.push(linked);
    }

    const inst = await prisma.workpackInstantiation.findMany({
      where: { workpack_id: { in: workpackIds }, organization_id: orgId },
      select: { workpack_id: true, event_id: true },
    });
    const instEventIds = inst.map((i) => i.event_id).filter(Boolean) as string[];
    const instEvents =
      instEventIds.length === 0
        ? []
        : await prisma.event.findMany({
            where: { id: { in: instEventIds }, organization_id: orgId },
            select: eventSelect,
          });
    for (const i of inst) {
      const ev = instEvents.find((e) => e.id === i.event_id);
      const linked = asLinked(ev ?? null, orgId);
      if (linked) map.get(i.workpack_id)?.instantiationEvents.push(linked);
    }

    const activities = await prisma.activity.findMany({
      where: { workpack_id: { in: workpackIds }, organization_id: orgId, deleted_at: null },
      select: {
        id: true,
        workpack_id: true,
        event_id: true,
        activity_number: true,
        description: true,
      },
    });
    const actEventIds = activities.map((a) => a.event_id).filter(Boolean) as string[];
    const actEvents =
      actEventIds.length === 0
        ? []
        : await prisma.event.findMany({
            where: { id: { in: actEventIds }, organization_id: orgId },
            select: eventSelect,
          });
    for (const a of activities) {
      if (!a.workpack_id || !a.event_id) continue;
      const ev = actEvents.find((e) => e.id === a.event_id);
      const linked = asLinked(ev ?? null, orgId);
      if (linked) {
        map.get(a.workpack_id)?.activityEvents.push({
          ...linked,
          activityLabel: a.activity_number || a.description,
        });
      }
    }

    if (activities.length) {
      const baselines = await prisma.baselineActivity.findMany({
        where: { activity_id: { in: activities.map((a) => a.id) } },
        select: {
          activity_id: true,
          baseline: { select: { event: { select: eventSelect } } },
        },
      });
      for (const b of baselines) {
        const act = activities.find((a) => a.id === b.activity_id);
        const linked = asLinked(b.baseline?.event ?? null, orgId);
        if (act?.workpack_id && linked) map.get(act.workpack_id)?.baselineEvents.push(linked);
      }
    }

    const unitIds = workpacks.map((w) => w.unit_id).filter(Boolean) as string[];
    if (unitIds.length) {
      const eus = await prisma.eventUnit.findMany({
        where: { unit_id: { in: unitIds }, event: { organization_id: orgId } },
        select: { unit_id: true, event: { select: eventSelect } },
      });
      for (const w of workpacks) {
        for (const eu of eus.filter((x) => x.unit_id === w.unit_id)) {
          const linked = asLinked(eu.event, orgId);
          if (linked) map.get(w.id)!.unitEvents.push(linked);
        }
      }
    }

    const systemIds = workpacks.map((w) => w.system_id).filter(Boolean) as string[];
    if (systemIds.length) {
      const ess = await prisma.eventSystem.findMany({
        where: { system_id: { in: systemIds }, event: { organization_id: orgId } },
        select: { system_id: true, event: { select: eventSelect } },
      });
      for (const w of workpacks) {
        for (const es of ess.filter((x) => x.system_id === w.system_id)) {
          const linked = asLinked(es.event, orgId);
          if (linked) map.get(w.id)!.systemEvents.push(linked);
        }
      }
    }

    const assetIds = workpacks.map((w) => w.asset_id).filter(Boolean) as string[];
    if (assetIds.length) {
      const sis = await prisma.scopeItem.findMany({
        where: { asset_id: { in: assetIds }, organization_id: orgId },
        select: { asset_id: true, scope: { select: { event: { select: eventSelect } } } },
      });
      for (const w of workpacks) {
        for (const si of sis.filter((x) => x.asset_id === w.asset_id)) {
          const linked = asLinked(si.scope?.event ?? null, orgId);
          if (linked) map.get(w.id)!.assetScopeEvents.push(linked);
        }
      }
    }

    return map;
  }
}
