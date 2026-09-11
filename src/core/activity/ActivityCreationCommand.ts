/**
 * R0.1 — Authoritative Activity creation command.
 *
 * ONE write path for business Activity creation. Adapters (template, API,
 * bulk, planner, AI) call this. Identity is resolved server-side.
 *
 * Does not invent a second identity engine. Governed values go through
 * ControlledValueResolver. Execution state is never accepted at create time.
 */

import { prisma } from '@/lib/prisma';
import type { PrismaTransactionClient } from '@/lib/prismaTypes';
import { AuditService } from '@/lib/audit';
import {
  ControlledValueResolver,
  ControlledValidationError,
} from '@/core/governance/ControlledValueResolver';
import { listedExecutionFields, EXECUTION_FIELD_REJECT_MESSAGE } from '@/core/execution/executionFieldGuard';
import { ActivityIdentityError } from './ActivityIdentityError';

const crypto = globalThis.crypto;

export type ActivityCreationSource =
  | 'web'
  | 'template'
  | 'excel'
  | 'api'
  | 'planner'
  | 'bulk'
  | 'mobile'
  | 'ai'
  | 'seed'
  | 'test'
  | 'clone';

export interface ActivityCreationContext {
  organizationId: string;
  userId: string;
  sourceChannel: ActivityCreationSource;
  /** Caller hint only. Never written unless it agrees with the resolved parent. */
  eventId?: string | null;
}

export interface ActivityCreationInput {
  workpackId?: string | null;
  /**
   * Legitimate exception: event-scoped (or legacy project-scoped) activity
   * without a workpack. Default is false — a workpack is required.
   */
  allowLoose?: boolean;
  description: string;
  activityNumber?: string | null;
  activityId?: string | null;
  durationHours?: number | null;
  disciplineId?: string | null;
  discipline?: string | null;
  standardActivityTypeId?: string | null;
  standardActivityType?: string | null;
  activityLibraryId?: string | null;
  activityCode?: string | null;
  workCategory?: string | null;
  notes?: string | null;
  wbsCode?: string | null;
  responsible?: string | null;
  holdPointType?: string | null;
  holdPointDescription?: string | null;
  isOptional?: boolean;
  sequenceNumber?: number | null;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  window?: string | null;
  siteId?: string | null;
  scopeItemId?: string | null;
  assetId?: string | null;
  assetTag?: string | null;
  equipmentTypeId?: string | null;
  equipmentType?: string | null;
  contractorId?: string | null;
  contractor?: string | null;
  templateId?: string | null;
  /**
   * Legacy project schedule path only. Not used as event_id, and no longer persisted:
   * OD9.1 retired Activity.project_id, which never existed as a database column. This
   * still marks the activity's provenance as 'imported' via schedule_source.
   */
  legacyProjectId?: string | null;
  loadDefaultResources?: boolean;
}

type WorkpackSnapshot = {
  id: string;
  organization_id: string;
  site_id: string;
  event_id: string | null;
  discipline_id: string | null;
  asset_id: string | null;
  unit_id: string | null;
  plant_id: string | null;
  system_id: string | null;
  contractor_id: string | null;
  equipment_type: string | null;
  workpack_number: string | null;
  deleted_at: Date | null;
  asset: {
    id: string;
    organization_id: string;
    equipment_type_id: string | null;
    plant_id: string | null;
    unit_id: string | null;
    system_id: string | null;
    tag_number: string;
  } | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t.length > 0 ? t : null;
}

function rejectExecutionFields(input: Record<string, unknown>): void {
  const listed = listedExecutionFields(input);
  if (listed.length > 0) {
    throw new ActivityIdentityError(
      'EXECUTION_FIELD_REJECTED',
      `${EXECUTION_FIELD_REJECT_MESSAGE} Rejected fields: ${listed.join(', ')}`
    );
  }
}

async function resolveWorkpack(
  db: PrismaTransactionClient,
  organizationId: string,
  workpackId: string
): Promise<WorkpackSnapshot> {
  const found = await db.workpack.findFirst({
    where: { id: workpackId, deleted_at: null },
    select: {
      id: true,
      organization_id: true,
      site_id: true,
      event_id: true,
      discipline_id: true,
      asset_id: true,
      unit_id: true,
      plant_id: true,
      system_id: true,
      contractor_id: true,
      equipment_type: true,
      workpack_number: true,
      deleted_at: true,
      asset: {
        select: {
          id: true,
          organization_id: true,
          equipment_type_id: true,
          plant_id: true,
          unit_id: true,
          system_id: true,
          tag_number: true,
        },
      },
    },
  });

  if (!found) {
    throw new ActivityIdentityError('INVALID_WORKPACK', `Workpack "${workpackId}" was not found.`);
  }
  if (found.organization_id !== organizationId) {
    throw new ActivityIdentityError(
      'CROSS_TENANT_WORKPACK',
      'Workpack does not belong to the caller organization.'
    );
  }
  return found;
}

async function resolveEvent(
  db: PrismaTransactionClient,
  organizationId: string,
  eventId: string
) {
  const event = await db.event.findFirst({
    where: { id: eventId, deleted_at: null },
    select: { id: true, organization_id: true, site_id: true },
  });
  if (!event) {
    throw new ActivityIdentityError('INVALID_EVENT', `Event "${eventId}" was not found.`);
  }
  if (event.organization_id !== organizationId) {
    throw new ActivityIdentityError(
      'CROSS_TENANT_EVENT',
      'Event does not belong to the caller organization.'
    );
  }
  return event;
}

async function resolveDisciplineId(
  organizationId: string,
  ref: string | null
): Promise<string | null> {
  if (!ref) return null;
  try {
    const disc = await ControlledValueResolver.resolveDiscipline(organizationId, ref);
    return disc?.id ?? null;
  } catch (error) {
    if (error instanceof ControlledValidationError) {
      throw new ActivityIdentityError('INVALID_DISCIPLINE', error.message);
    }
    throw error;
  }
}

async function resolveEquipmentTypeId(
  organizationId: string,
  explicit: boolean,
  ref: string | null
): Promise<string | null> {
  if (!ref) return null;
  try {
    const et = await ControlledValueResolver.resolveEquipmentType(organizationId, ref);
    return et?.id ?? null;
  } catch (error) {
    if (error instanceof ControlledValidationError) {
      if (explicit) throw error;
      return null;
    }
    throw error;
  }
}

async function resolveStandardActivityId(opts: {
  equipmentTypeId: string | null;
  explicitId: string | null;
  explicitCode: string | null;
  inferredCode: string | null;
}): Promise<string | null> {
  const explicitRef = opts.explicitId || opts.explicitCode;
  if (explicitRef) {
    if (!opts.equipmentTypeId) {
      throw new ActivityIdentityError(
        'INVALID_STANDARD_ACTIVITY',
        'A standard activity type was supplied but no governed equipment type is available to resolve it. The server will not guess.'
      );
    }
    const sat = await ControlledValueResolver.resolveStandardActivity(opts.equipmentTypeId, explicitRef);
    return sat?.id ?? null;
  }

  if (opts.inferredCode && opts.equipmentTypeId) {
    try {
      const sat = await ControlledValueResolver.resolveStandardActivity(
        opts.equipmentTypeId,
        opts.inferredCode
      );
      return sat?.id ?? null;
    } catch (error) {
      if (error instanceof ControlledValidationError) {
        return null;
      }
      throw error;
    }
  }

  return null;
}

/**
 * Authoritative Activity creation.
 * When `db` is omitted the persist step runs inside prisma.$transaction.
 */
export async function createActivity(
  context: ActivityCreationContext,
  input: ActivityCreationInput,
  db?: PrismaTransactionClient
) {
  if (!db) {
    return prisma.$transaction((tx) => createActivity(context, input, tx));
  }

  rejectExecutionFields(input as unknown as Record<string, unknown>);

  const organizationId = trimOrNull(context.organizationId);
  const userId = trimOrNull(context.userId);
  const description = trimOrNull(input.description);

  if (!organizationId) {
    throw new ActivityIdentityError('MISSING_REQUIRED_IDENTITY', 'organizationId is required.');
  }
  if (!userId) {
    throw new ActivityIdentityError('MISSING_REQUIRED_IDENTITY', 'userId is required.');
  }
  if (!description) {
    throw new ActivityIdentityError('MISSING_REQUIRED_IDENTITY', 'Activity description is required.');
  }

  const workpackId = trimOrNull(input.workpackId);
  const callerEventId = trimOrNull(context.eventId);
  const allowLoose = input.allowLoose === true;
  const legacyProjectId = trimOrNull(input.legacyProjectId);

  if (!workpackId && !allowLoose) {
    throw new ActivityIdentityError(
      'MISSING_REQUIRED_IDENTITY',
      'A workpack is required to create an activity.'
    );
  }
  if (!workpackId && allowLoose && !callerEventId && !legacyProjectId) {
    throw new ActivityIdentityError(
      'MISSING_REQUIRED_IDENTITY',
      'A loose activity requires a validated event (or a legacy project id).'
    );
  }

  const workpack = workpackId
    ? await resolveWorkpack(db, organizationId, workpackId)
    : null;

  let resolvedEventId: string | null = null;
  let resolvedSiteId: string | null = workpack?.site_id ?? null;

  if (workpack) {
    if (callerEventId && workpack.event_id && callerEventId !== workpack.event_id) {
      throw new ActivityIdentityError(
        'EVENT_MISMATCH',
        'Activity event does not agree with workpack event. The server derives event identity from the workpack.'
      );
    }
    resolvedEventId = workpack.event_id;
    if (resolvedEventId) {
      const event = await resolveEvent(db, organizationId, resolvedEventId);
      resolvedSiteId = workpack.site_id || event.site_id;
    }
  } else if (callerEventId) {
    const event = await resolveEvent(db, organizationId, callerEventId);
    resolvedEventId = event.id;
    resolvedSiteId = event.site_id;
  }

  const requestedSiteId = trimOrNull(input.siteId);
  if (requestedSiteId) {
    if (workpack && requestedSiteId !== workpack.site_id) {
      throw new ActivityIdentityError(
        'INVALID_SITE',
        'Supplied site_id does not match the workpack site.'
      );
    }
    const site = await db.site.findFirst({
      where: { id: requestedSiteId, organization_id: organizationId },
      select: { id: true },
    });
    if (!site) {
      throw new ActivityIdentityError('INVALID_SITE', 'Site does not belong to the caller organization.');
    }
    if (!resolvedSiteId) resolvedSiteId = site.id;
  }

  if (!resolvedSiteId) {
    throw new ActivityIdentityError('MISSING_REQUIRED_IDENTITY', 'A site could not be derived for the activity.');
  }

  if (trimOrNull(input.scopeItemId)) {
    const scopeItem = await db.scopeItem.findFirst({
      where: { id: input.scopeItemId!, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (!scopeItem) {
      throw new ActivityIdentityError(
        'MISSING_REQUIRED_IDENTITY',
        'scope_item_id does not belong to the caller organization.'
      );
    }
  }

  const explicitAssetRef = trimOrNull(input.assetId) || trimOrNull(input.assetTag);
  if (explicitAssetRef) {
    try {
      const asset = await ControlledValueResolver.resolveAsset(organizationId, {
        id: trimOrNull(input.assetId) ?? undefined,
        tagNumber: trimOrNull(input.assetTag) ?? undefined,
        plantId: workpack?.plant_id ?? workpack?.asset?.plant_id ?? undefined,
        unitId: workpack?.unit_id ?? workpack?.asset?.unit_id ?? undefined,
      });
      if (!asset) {
        throw new ActivityIdentityError('INVALID_ASSET', 'Asset could not be resolved.');
      }
      if (asset.organization_id && asset.organization_id !== organizationId) {
        throw new ActivityIdentityError('CROSS_TENANT_ASSET', 'Asset does not belong to the caller organization.');
      }
      if (workpack?.asset_id && workpack.asset_id !== asset.id) {
        throw new ActivityIdentityError(
          'ASSET_CONFLICT',
          'Supplied asset conflicts with the workpack equipment context.'
        );
      }
    } catch (error) {
      if (error instanceof ControlledValidationError) {
        throw new ActivityIdentityError('INVALID_ASSET', error.message);
      }
      throw error;
    }
  }

  const hierarchyIds = {
    plantId: workpack?.plant_id ?? workpack?.asset?.plant_id ?? undefined,
    unitId: workpack?.unit_id ?? workpack?.asset?.unit_id ?? undefined,
    systemId: workpack?.system_id ?? workpack?.asset?.system_id ?? undefined,
  };
  if (hierarchyIds.plantId || hierarchyIds.unitId || hierarchyIds.systemId) {
    const hierarchy = await ControlledValueResolver.validateHierarchy(organizationId, hierarchyIds);
    if (!hierarchy.valid) {
      throw new ActivityIdentityError('INVALID_HIERARCHY', hierarchy.errors.join(' '));
    }
  }

  const contractorRef = trimOrNull(input.contractorId) || trimOrNull(input.contractor);
  if (contractorRef) {
    await ControlledValueResolver.resolveContractor(organizationId, contractorRef);
  }

  const disciplineRef =
    trimOrNull(input.disciplineId) || trimOrNull(input.discipline) || workpack?.discipline_id || null;
  const disciplineId = await resolveDisciplineId(organizationId, disciplineRef);

  const explicitEquipmentTypeId = trimOrNull(input.equipmentTypeId);
  let equipmentTypeId = explicitEquipmentTypeId ?? workpack?.asset?.equipment_type_id ?? null;
  if (explicitEquipmentTypeId) {
    equipmentTypeId = await resolveEquipmentTypeId(organizationId, true, explicitEquipmentTypeId);
  } else if (!equipmentTypeId) {
    equipmentTypeId = await resolveEquipmentTypeId(
      organizationId,
      false,
      trimOrNull(input.equipmentType) || workpack?.equipment_type || null
    );
  }

  const standardActivityTypeId = await resolveStandardActivityId({
    equipmentTypeId,
    explicitId: trimOrNull(input.standardActivityTypeId),
    explicitCode: trimOrNull(input.standardActivityType),
    inferredCode: trimOrNull(input.activityCode),
  });

  let sequenceNumber = input.sequenceNumber ?? null;
  if (sequenceNumber == null) {
    const lastSeq = await db.activity.aggregate({
      where: workpack
        ? { workpack_id: workpack.id, deleted_at: null }
        : { organization_id: organizationId, event_id: resolvedEventId, deleted_at: null },
      _max: { sequence_number: true },
    });
    sequenceNumber = (lastSeq._max.sequence_number ?? 0) + 1;
  }

  const activityNumber =
    trimOrNull(input.activityNumber) ||
    (workpack?.workpack_number
      ? `${workpack.workpack_number}-${String(sequenceNumber).padStart(4, '0')}`
      : null);

  const id = crypto.randomUUID();
  const created = await db.activity.create({
    data: {
      id,
      organization_id: organizationId,
      site_id: resolvedSiteId,
      workpack_id: workpack?.id ?? null,
      event_id: resolvedEventId,
      activity_library_id: trimOrNull(input.activityLibraryId),
      sequence_number: sequenceNumber,
      activity_number: activityNumber,
      activity_id: trimOrNull(input.activityId),
      description,
      discipline_id: disciplineId,
      duration_hours: input.durationHours ?? 0,
      work_category: trimOrNull(input.workCategory),
      notes: trimOrNull(input.notes),
      wbs_code: trimOrNull(input.wbsCode),
      responsible: trimOrNull(input.responsible),
      hold_point_type: trimOrNull(input.holdPointType),
      hold_point_description: trimOrNull(input.holdPointDescription),
      is_optional: input.isOptional === true,
      window: trimOrNull(input.window),
      // Sprint 1b — planned dates are CPM-derived. Create leaves them null;
      // M11 fills them on the next recalc. Pins go through PlannedDateAuthority.
      planned_start: null,
      planned_end: null,
      status: 'not_started',
      progress_percent: 0,
      created_by: userId,
      schedule_source: workpack ? 'workpack' : legacyProjectId ? 'imported' : null,
      standard_activity_type_id: standardActivityTypeId,
    },
  });

  if (input.loadDefaultResources !== false && workpack && trimOrNull(input.activityLibraryId)) {
    const defaults = await db.activity_code_default_resources.findMany({
      where: { library_id: input.activityLibraryId! },
    });
    if (defaults.length > 0) {
      await db.activityResource.createMany({
        data: defaults.map((d) => ({
          id: crypto.randomUUID(),
          organization_id: organizationId,
          workpack_id: workpack.id,
          activity_id: created.id,
          resource_id: d.resource_id,
          quantity: d.quantity,
        })),
      });
    }
  }

  await AuditService.log(
    {
      organization_id: organizationId,
      user_id: userId,
      action: 'created',
      model_name: 'Activity',
      model_id: created.id,
      new_values: {
        ...(created as unknown as Record<string, unknown>),
        source_channel: context.sourceChannel,
        template_id: trimOrNull(input.templateId),
      },
      site_id: resolvedSiteId,
    },
    db
  );

  return created;
}

export const ActivityCreationCommand = {
  createActivity,
};
