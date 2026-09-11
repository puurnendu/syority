/**
 * R0.2 — Controlled existing Activity identity backfill.
 *
 * Derives identity only from authoritative existing relationships.
 * Does not guess. Does not create a second resolver: SAT / discipline /
 * equipment type use the same predicates as ControlledValueResolver.
 */

import { createHash, randomUUID } from 'crypto';
import type {
  ActivityBackfillProposal,
  ActivityIdentityRow,
  BackfillDatabase,
  BackfillMode,
  BackfillRunSummary,
  CensusCounts,
  FieldDecision,
  FieldProposal,
  IdentityValues,
  ManifestRecord,
  WorkpackIdentityRow,
} from './identityBackfillTypes';
import { R02_SOURCE } from './identityBackfillTypes';

const LIBRARY_CODE = /^ACT[-_]/i;

export interface BackfillRunState {
  summary: BackfillRunSummary;
  proposals: ActivityBackfillProposal[];
  manifest: ManifestRecord[];
}

function hashValues(values: IdentityValues): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function identityOf(row: ActivityIdentityRow): IdentityValues {
  return {
    event_id: row.event_id,
    discipline_id: row.discipline_id,
    standard_activity_type_id: row.standard_activity_type_id,
  };
}

function isLegacy(row: ActivityIdentityRow): boolean {
  return (
    row.schedule_source === 'imported' ||
    row.p6_activity_id != null ||
    row.p6_object_id != null
  );
}

function emptyCensus(): CensusCounts {
  return {
    activities_total: 0,
    live: 0,
    soft_deleted: 0,
    missing_event_id: 0,
    valid_event_id: 0,
    event_agrees_with_workpack: 0,
    event_contradiction: 0,
    event_deterministic_candidate: 0,
    event_unresolved: 0,
    workpack_missing: 0,
    workpack_cross_tenant: 0,
    workpack_event_missing: 0,
    missing_discipline: 0,
    valid_discipline: 0,
    discipline_invalid_or_cross_tenant: 0,
    discipline_deterministic_candidate: 0,
    missing_sat: 0,
    valid_sat: 0,
    sat_invalid: 0,
    sat_uniquely_derivable: 0,
    sat_ambiguous: 0,
    sat_not_derivable: 0,
    library_code_not_sat: 0,
    equipment_type_context_missing: 0,
    hierarchy_inconsistent: 0,
    loose_activities: 0,
    legacy_imported: 0,
    cross_tenant: 0,
  };
}

export class ActivityIdentityBackfillService {
  constructor(private readonly db: BackfillDatabase) {}

  async census(): Promise<{ counts: CensusCounts; proposals: ActivityBackfillProposal[] }> {
    const proposals = await this.evaluateAll();
    return { counts: this.summarizeCensus(proposals), proposals };
  }

  async dryRun(operator = 'r0.2'): Promise<BackfillRunState> {
    return this.buildRun('dry_run', operator, await this.evaluateAll(), false);
  }

  /**
   * Apply is a separate step. It updates only AUTO_SAFE field changes
   * from a prior evaluation. Ambiguous / contradictory / loose / legacy
   * rows are never written.
   */
  async apply(operator = 'r0.2', options?: { batchSize?: number; onlyActivityIds?: string[] }): Promise<BackfillRunState> {
    const proposals = await this.evaluateAll();
    const unexpected = this.detectUnexpected(proposals);
    if (unexpected.length > 0) {
      throw new Error(`R0.2 apply blocked: unexpected relationships: ${unexpected.join('; ')}`);
    }

    const run = await this.buildRun('apply', operator, proposals, false);
    const batchSize = options?.batchSize ?? 100;
    const allow = options?.onlyActivityIds ? new Set(options.onlyActivityIds) : null;
    const safe = run.manifest.filter((m) =>
      m.validationResult === 'AUTO_SAFE'
      && m.fieldsChanged.length > 0
      && (!allow || allow.has(m.activityId))
    );

    for (let i = 0; i < safe.length; i += batchSize) {
      const batch = safe.slice(i, i + batchSize);
      for (const entry of batch) {
        const ok = await this.db.updateActivityIdentity(
          entry.activityId,
          entry.organizationId,
          entry.oldValues,
          entry.newValues
        );
        if (!ok) {
          throw new Error(`R0.2 apply stopped: optimistic lock failed for activity ${entry.activityId}`);
        }
        await this.db.writeAudit({
          organizationId: entry.organizationId,
          activityId: entry.activityId,
          oldValues: {
            ...entry.oldValues,
            source: R02_SOURCE,
            runId: run.summary.runId,
            operator,
            derivation_reason: entry.derivationSource,
          },
          newValues: {
            ...entry.newValues,
            source: R02_SOURCE,
            runId: run.summary.runId,
            operator,
            derivation_reason: entry.derivationSource,
          },
        });
        entry.applied = true;
        entry.rowHashAfter = hashValues(entry.newValues);
        run.summary.applied += 1;
      }
    }

    run.summary.mode = 'apply';
    run.summary.completedAt = new Date().toISOString();
    return run;
  }

  async rollback(run: BackfillRunState, operator = 'r0.2'): Promise<BackfillRunState> {
    const applied = run.manifest.filter((m) => m.applied && !m.rolledBack);
    for (const entry of applied) {
      const ok = await this.db.updateActivityIdentity(
        entry.activityId,
        entry.organizationId,
        entry.newValues,
        entry.oldValues
      );
      if (!ok) {
        throw new Error(`R0.2 rollback stopped: activity ${entry.activityId} no longer matches applied values`);
      }
      await this.db.writeAudit({
        organizationId: entry.organizationId,
        activityId: entry.activityId,
        oldValues: { ...entry.newValues, source: R02_SOURCE, runId: run.summary.runId, action: 'rollback' },
        newValues: { ...entry.oldValues, source: R02_SOURCE, runId: run.summary.runId, action: 'rollback', operator },
      });
      entry.rolledBack = true;
      entry.applied = false;
      run.summary.rolledBack += 1;
    }
    run.summary.mode = 'rollback';
    run.summary.completedAt = new Date().toISOString();
    return run;
  }

  async evaluateAll(): Promise<ActivityBackfillProposal[]> {
    const activities = await this.db.loadActivities();
    const workpackIds = [...new Set(activities.map((a) => a.workpack_id).filter((id): id is string => !!id))];
    const workpacks = await this.db.loadWorkpacks(workpackIds);
    const workpackById = new Map(workpacks.map((w) => [w.id, w]));

    const eventIds = [
      ...new Set(
        [
          ...activities.map((a) => a.event_id),
          ...workpacks.map((w) => w.event_id),
        ].filter((id): id is string => !!id)
      ),
    ];
    const events = await this.db.loadEvents(eventIds);
    const eventById = new Map(events.map((e) => [e.id, e]));

    const templateIds = [...new Set(workpacks.map((w) => w.template_id).filter((id): id is string => !!id))];
    const templates = await this.db.loadTemplates(templateIds);
    const templateById = new Map(templates.map((t) => [t.id, t]));

    const disciplineIds = [
      ...new Set(
        [
          ...activities.map((a) => a.discipline_id),
          ...workpacks.map((w) => w.discipline_id),
          ...templates.map((t) => t.discipline_id),
        ].filter((id): id is string => !!id)
      ),
    ];
    const disciplines = await this.db.loadDisciplines(disciplineIds);
    const disciplineById = new Map(disciplines.map((d) => [d.id, d]));

    const assetIds = [...new Set(workpacks.map((w) => w.asset_id).filter((id): id is string => !!id))];
    const assets = await this.db.loadAssets(assetIds);
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const unitIds = [
      ...new Set(
        [
          ...workpacks.map((w) => w.unit_id),
          ...assets.map((a) => a.unit_id),
        ].filter((id): id is string => !!id)
      ),
    ];
    const units = await this.db.loadUnits(unitIds);
    const unitById = new Map(units.map((u) => [u.id, u]));

    const systemIds = [
      ...new Set(
        [
          ...workpacks.map((w) => w.system_id),
          ...assets.map((a) => a.system_id),
        ].filter((id): id is string => !!id)
      ),
    ];
    const systems = await this.db.loadSystems(systemIds);
    const systemById = new Map(systems.map((s) => [s.id, s]));

    const libraryIds = [...new Set(activities.map((a) => a.activity_library_id).filter((id): id is string => !!id))];
    const libraries = await this.db.loadLibraries(libraryIds);
    const libraryById = new Map(libraries.map((l) => [l.id, l]));

    const proposals: ActivityBackfillProposal[] = [];
    for (const activity of activities) {
      proposals.push(
        await this.evaluateOne(activity, {
          workpack: activity.workpack_id ? workpackById.get(activity.workpack_id) ?? null : null,
          eventById,
          disciplineById,
          assetById,
          unitById,
          systemById,
          libraryById,
          templateById,
        })
      );
    }
    return proposals;
  }

  private async evaluateOne(
    activity: ActivityIdentityRow,
    ctx: {
      workpack: WorkpackIdentityRow | null | undefined;
      eventById: Map<string, { id: string; organization_id: string; deleted_at: Date | string | null }>;
      disciplineById: Map<string, { id: string; organization_id: string; code: string; is_active: boolean | null }>;
      assetById: Map<string, { id: string; organization_id: string; equipment_type_id: string | null; plant_id: string | null; unit_id: string | null; system_id: string | null }>;
      unitById: Map<string, { id: string; organization_id: string; plant_id: string | null; area_id: string | null }>;
      systemById: Map<string, { id: string; organization_id: string; unit_id: string | null }>;
      libraryById: Map<string, { id: string; organization_id: string; activity_code: string | null }>;
      templateById: Map<string, { id: string; organization_id: string | null; discipline_id: string | null; equipment_type: string | null }>;
    }
  ): Promise<ActivityBackfillProposal> {
    const classifications: FieldDecision[] = [];
    const fields: FieldProposal[] = [];
    const old = identityOf(activity);
    const next: IdentityValues = { ...old };
    const reasons: string[] = [];
    let excluded = false;
    let excludeReason: string | null = null;

    const quarantine = (decision: FieldDecision, reason: string) => {
      excluded = true;
      excludeReason = excludeReason ?? reason;
      classifications.push(decision);
    };

    if (activity.deleted_at) {
      quarantine('SOFT_DELETED', 'Soft-deleted activities are not repaired.');
    } else if (isLegacy(activity)) {
      quarantine('LEGACY_IMPORTED', 'P6/imported legacy activities are not auto-repaired.');
    } else if (!activity.workpack_id) {
      quarantine('LOOSE_ACTIVITY', 'Loose activity: event_id is not derived from project_id or any other guess.');
    } else if (!ctx.workpack) {
      quarantine('WORKPACK_MISSING', 'workpack_id is set but the workpack row was not found.');
    } else if (ctx.workpack.organization_id !== activity.organization_id) {
      quarantine('CROSS_TENANT_WORKPACK', 'Workpack organization does not match activity organization.');
    }

    const workpack = excluded ? null : ctx.workpack ?? null;
    const asset = workpack?.asset_id ? ctx.assetById.get(workpack.asset_id) ?? null : null;
    if (asset && asset.organization_id !== activity.organization_id) {
      quarantine('CROSS_TENANT_RELATIONSHIP', 'Workpack asset belongs to another tenant.');
    }

    const hierarchyErrors = this.validateHierarchy(activity.organization_id, workpack, asset, ctx.unitById, ctx.systemById);
    if (hierarchyErrors.length > 0 && !excluded) {
      quarantine('INVALID_HIERARCHY', hierarchyErrors.join(' '));
    }

    // Event
    if (excluded) {
      fields.push({
        field: 'event_id',
        oldValue: old.event_id,
        proposedValue: old.event_id,
        decision: classifications[0] ?? 'EXCLUDED',
        derivationReason: excludeReason ?? 'excluded',
      });
    } else if (workpack) {
      const wpEvent = workpack.event_id ? ctx.eventById.get(workpack.event_id) : null;
      if (activity.event_id && workpack.event_id && activity.event_id !== workpack.event_id) {
        classifications.push('EVENT_CONTRADICTION');
        fields.push({
          field: 'event_id',
          oldValue: old.event_id,
          proposedValue: old.event_id,
          decision: 'EVENT_CONTRADICTION',
          derivationReason: 'Activity.event_id disagrees with Workpack.event_id. Not overwritten.',
        });
      } else if (activity.event_id && workpack.event_id && activity.event_id === workpack.event_id) {
        classifications.push('EVENT_AGREES');
        fields.push({
          field: 'event_id',
          oldValue: old.event_id,
          proposedValue: old.event_id,
          decision: 'EVENT_AGREES',
          derivationReason: 'Activity.event_id already agrees with Workpack.event_id.',
        });
      } else if (!activity.event_id && workpack.event_id && wpEvent && wpEvent.organization_id === activity.organization_id && !wpEvent.deleted_at) {
        next.event_id = workpack.event_id;
        classifications.push('AUTO_SAFE');
        reasons.push('DERIVED_FROM_WORKPACK_EVENT');
        fields.push({
          field: 'event_id',
          oldValue: null,
          proposedValue: workpack.event_id,
          decision: 'AUTO_SAFE',
          derivationReason: 'Activity.event_id was null; Workpack.event_id is set, same tenant, event exists.',
        });
      } else {
        classifications.push('EVENT_UNRESOLVED');
        fields.push({
          field: 'event_id',
          oldValue: old.event_id,
          proposedValue: old.event_id,
          decision: 'EVENT_UNRESOLVED',
          derivationReason: 'No deterministic workpack event. project_id is never used as event_id.',
        });
      }
    }

    // Discipline — only when the row is not quarantined
    if (excluded) {
      fields.push({
        field: 'discipline_id',
        oldValue: old.discipline_id,
        proposedValue: old.discipline_id,
        decision: 'EXCLUDED',
        derivationReason: excludeReason ?? 'excluded',
      });
    } else {
      const existing = activity.discipline_id ? ctx.disciplineById.get(activity.discipline_id) : null;
      if (activity.discipline_id && (!existing || existing.organization_id !== activity.organization_id)) {
        classifications.push('DISCIPLINE_INVALID');
        fields.push({
          field: 'discipline_id',
          oldValue: old.discipline_id,
          proposedValue: old.discipline_id,
          decision: 'DISCIPLINE_INVALID',
          derivationReason: 'Existing discipline_id is missing or cross-tenant. Not overwritten.',
        });
      } else if (existing && existing.organization_id === activity.organization_id) {
        fields.push({
          field: 'discipline_id',
          oldValue: old.discipline_id,
          proposedValue: old.discipline_id,
          decision: 'UNCHANGED',
          derivationReason: 'Existing Activity discipline is valid.',
        });
      } else {
        const candidateId = workpack?.discipline_id
          || (workpack?.template_id ? ctx.templateById.get(workpack.template_id)?.discipline_id ?? null : null);
        const source = workpack?.discipline_id ? 'workpack' : 'template';
        const candidate = candidateId ? ctx.disciplineById.get(candidateId) : null;
        if (candidate && candidate.organization_id === activity.organization_id && candidate.is_active !== false) {
          next.discipline_id = candidate.id;
          classifications.push('AUTO_SAFE');
          reasons.push(`DERIVED_FROM_${source.toUpperCase()}_DISCIPLINE`);
          fields.push({
            field: 'discipline_id',
            oldValue: null,
            proposedValue: candidate.id,
            decision: 'AUTO_SAFE',
            derivationReason: `Unique governed discipline from ${source} (${candidate.code}).`,
          });
        } else if (candidate && candidate.organization_id !== activity.organization_id) {
          classifications.push('DISCIPLINE_INVALID');
          fields.push({
            field: 'discipline_id',
            oldValue: null,
            proposedValue: null,
            decision: 'DISCIPLINE_INVALID',
            derivationReason: 'Workpack/template discipline belongs to another tenant. Not used.',
          });
        } else if (candidateId && !candidate) {
          classifications.push('DISCIPLINE_AMBIGUOUS');
          fields.push({
            field: 'discipline_id',
            oldValue: null,
            proposedValue: null,
            decision: 'DISCIPLINE_AMBIGUOUS',
            derivationReason: 'Referenced discipline could not be uniquely resolved in this tenant.',
          });
        } else {
          classifications.push('DISCIPLINE_UNRESOLVED');
          fields.push({
            field: 'discipline_id',
            oldValue: null,
            proposedValue: null,
            decision: 'DISCIPLINE_UNRESOLVED',
            derivationReason: 'No authoritative workpack/template discipline. Free text is not used.',
          });
        }
      }
    }

    // SAT
    if (excluded) {
      fields.push({
        field: 'standard_activity_type_id',
        oldValue: old.standard_activity_type_id,
        proposedValue: old.standard_activity_type_id,
        decision: 'EXCLUDED',
        derivationReason: excludeReason ?? 'excluded',
      });
    } else {
      const satField = await this.evaluateSat(activity, workpack, asset, ctx);
      fields.push(satField);
      if (satField.decision === 'AUTO_SAFE' && satField.proposedValue) {
        next.standard_activity_type_id = satField.proposedValue;
        classifications.push('AUTO_SAFE');
        reasons.push(satField.derivationReason);
      } else if (satField.decision !== 'UNCHANGED') {
        classifications.push(satField.decision);
      }
    }

    const hasSafeChange = fields.some((f) => f.decision === 'AUTO_SAFE' && f.oldValue !== f.proposedValue);
    const validation: ActivityBackfillProposal['validation_result'] = excluded
      ? 'QUARANTINED'
      : hasSafeChange
        ? 'AUTO_SAFE'
        : 'UNCHANGED';

    if (hasSafeChange && !classifications.includes('AUTO_SAFE')) classifications.push('AUTO_SAFE');

    return {
      activityId: activity.id,
      workpackId: activity.workpack_id,
      organizationId: activity.organization_id,
      old_event_id: old.event_id,
      proposed_event_id: next.event_id,
      old_discipline_id: old.discipline_id,
      proposed_discipline_id: next.discipline_id,
      old_standard_activity_type_id: old.standard_activity_type_id,
      proposed_standard_activity_type_id: next.standard_activity_type_id,
      derivation_reason: reasons.join('|') || excludeReason || 'NO_DETERMINISTIC_CHANGE',
      validation_result: validation,
      classification: [...new Set(classifications)],
      fields,
      row_hash_before: hashValues(old),
      excluded,
      excludeReason,
    };
  }

  private async evaluateSat(
    activity: ActivityIdentityRow,
    workpack: WorkpackIdentityRow | null,
    asset: { equipment_type_id: string | null } | null,
    ctx: {
      libraryById: Map<string, { id: string; organization_id: string; activity_code: string | null }>;
    }
  ): Promise<FieldProposal> {
    if (activity.standard_activity_type_id) {
      const match = await this.db.loadStandardActivityById(activity.standard_activity_type_id);
      if (match) {
        return {
          field: 'standard_activity_type_id',
          oldValue: activity.standard_activity_type_id,
          proposedValue: activity.standard_activity_type_id,
          decision: 'UNCHANGED',
          derivationReason: 'Existing SAT FK is valid.',
        };
      }
      return {
        field: 'standard_activity_type_id',
        oldValue: activity.standard_activity_type_id,
        proposedValue: activity.standard_activity_type_id,
        decision: 'SAT_UNRESOLVED',
        derivationReason: 'Existing SAT FK does not resolve. Not overwritten.',
      };
    }

    const library = activity.activity_library_id ? ctx.libraryById.get(activity.activity_library_id) : null;
    const code = library?.activity_code?.trim() || null;
    if (!code) {
      return {
        field: 'standard_activity_type_id',
        oldValue: null,
        proposedValue: null,
        decision: 'SAT_UNRESOLVED',
        derivationReason: 'No library SAT code and no existing SAT. Description/activity_number are not used.',
      };
    }
    if (LIBRARY_CODE.test(code)) {
      return {
        field: 'standard_activity_type_id',
        oldValue: null,
        proposedValue: null,
        decision: 'LIBRARY_CODE_NOT_SAT',
        derivationReason: `Library code "${code}" is not mapped to a Standard Activity Type.`,
      };
    }

    let equipmentTypeId = asset?.equipment_type_id ?? null;
    if (!equipmentTypeId && workpack?.equipment_type) {
      const types = await this.db.loadEquipmentTypes(workpack.equipment_type);
      if (types.length > 1) {
        return {
          field: 'standard_activity_type_id',
          oldValue: null,
          proposedValue: null,
          decision: 'SAT_AMBIGUOUS',
          derivationReason: 'Multiple equipment types match workpack.equipment_type.',
        };
      }
      equipmentTypeId = types[0]?.id ?? null;
    }
    if (!equipmentTypeId) {
      return {
        field: 'standard_activity_type_id',
        oldValue: null,
        proposedValue: null,
        decision: 'SAT_UNRESOLVED',
        derivationReason: 'SAT requires governed equipment type context. None is available.',
      };
    }

    const sats = await this.db.loadStandardActivities(equipmentTypeId, code);
    if (sats.length > 1) {
      return {
        field: 'standard_activity_type_id',
        oldValue: null,
        proposedValue: null,
        decision: 'SAT_AMBIGUOUS',
        derivationReason: `Multiple SAT rows match "${code}" for equipment type ${equipmentTypeId}.`,
      };
    }
    if (sats.length === 1) {
      return {
        field: 'standard_activity_type_id',
        oldValue: null,
        proposedValue: sats[0].id,
        decision: 'AUTO_SAFE',
        derivationReason: `ControlledValueResolver-equivalent unique SAT ${sats[0].code} for equipment type.`,
      };
    }
    return {
      field: 'standard_activity_type_id',
      oldValue: null,
      proposedValue: null,
      decision: 'LIBRARY_CODE_NOT_SAT',
      derivationReason: `Code "${code}" is not a SAT for the workpack equipment type.`,
    };
  }

  private validateHierarchy(
    orgId: string,
    workpack: WorkpackIdentityRow | null,
    asset: { plant_id: string | null; unit_id: string | null; system_id: string | null } | null,
    unitById: Map<string, { id: string; organization_id: string; plant_id: string | null; area_id: string | null }>,
    systemById: Map<string, { id: string; organization_id: string; unit_id: string | null }>
  ): string[] {
    if (!workpack) return [];
    const plantId = workpack.plant_id ?? asset?.plant_id ?? undefined;
    const unitId = workpack.unit_id ?? asset?.unit_id ?? undefined;
    const systemId = workpack.system_id ?? asset?.system_id ?? undefined;
    const errors: string[] = [];
    if (unitId) {
      const unit = unitById.get(unitId);
      if (!unit || unit.organization_id !== orgId) {
        errors.push(`Unit "${unitId}" does not exist in this organization.`);
      } else if (plantId && unit.plant_id && unit.plant_id !== plantId) {
        errors.push(`Unit belongs to plant "${unit.plant_id}", not "${plantId}".`);
      }
    }
    if (systemId) {
      const system = systemById.get(systemId);
      if (!system || system.organization_id !== orgId) {
        errors.push(`System "${systemId}" does not exist in this organization.`);
      } else if (unitId && system.unit_id && system.unit_id !== unitId) {
        errors.push(`System belongs to unit "${system.unit_id}", not "${unitId}".`);
      }
    }
    return errors;
  }

  summarizeCensus(proposals: ActivityBackfillProposal[]): CensusCounts {
    const c = emptyCensus();
    c.activities_total = proposals.length;
    for (const p of proposals) {
      const tags = new Set(p.classification);
      if (tags.has('SOFT_DELETED')) c.soft_deleted += 1;
      else c.live += 1;
      if (p.old_event_id) c.valid_event_id += 1;
      else if (!tags.has('SOFT_DELETED')) c.missing_event_id += 1;
      if (tags.has('EVENT_AGREES')) c.event_agrees_with_workpack += 1;
      if (tags.has('EVENT_CONTRADICTION')) c.event_contradiction += 1;
      if (p.fields.some((f) => f.field === 'event_id' && f.decision === 'AUTO_SAFE')) c.event_deterministic_candidate += 1;
      if (tags.has('EVENT_UNRESOLVED')) c.event_unresolved += 1;
      if (tags.has('WORKPACK_MISSING')) c.workpack_missing += 1;
      if (tags.has('CROSS_TENANT_WORKPACK')) {
        c.workpack_cross_tenant += 1;
        c.cross_tenant += 1;
      }
      if (tags.has('CROSS_TENANT_RELATIONSHIP')) c.cross_tenant += 1;
      if (p.old_discipline_id) c.valid_discipline += 1;
      else if (!tags.has('SOFT_DELETED')) c.missing_discipline += 1;
      if (tags.has('DISCIPLINE_INVALID')) c.discipline_invalid_or_cross_tenant += 1;
      if (p.fields.some((f) => f.field === 'discipline_id' && f.decision === 'AUTO_SAFE')) {
        c.discipline_deterministic_candidate += 1;
      }
      if (p.old_standard_activity_type_id) c.valid_sat += 1;
      else if (!tags.has('SOFT_DELETED')) c.missing_sat += 1;
      if (p.fields.some((f) => f.field === 'standard_activity_type_id' && f.decision === 'AUTO_SAFE')) {
        c.sat_uniquely_derivable += 1;
      }
      if (tags.has('SAT_AMBIGUOUS')) c.sat_ambiguous += 1;
      if (tags.has('SAT_UNRESOLVED')) c.sat_not_derivable += 1;
      if (tags.has('LIBRARY_CODE_NOT_SAT')) c.library_code_not_sat += 1;
      if (tags.has('LOOSE_ACTIVITY')) c.loose_activities += 1;
      if (tags.has('LEGACY_IMPORTED')) c.legacy_imported += 1;
      if (tags.has('INVALID_HIERARCHY')) c.hierarchy_inconsistent += 1;
    }
    return c;
  }

  detectUnexpected(proposals: ActivityBackfillProposal[]): string[] {
    const unexpected: string[] = [];
    const contradictions = proposals.filter((p) => p.classification.includes('EVENT_CONTRADICTION'));
    const cross = proposals.filter((p) =>
      p.classification.includes('CROSS_TENANT_WORKPACK') || p.classification.includes('CROSS_TENANT_RELATIONSHIP')
    );
    if (contradictions.length > 0) {
      unexpected.push(`${contradictions.length} EVENT_CONTRADICTION row(s)`);
    }
    if (cross.length > 0) {
      unexpected.push(`${cross.length} CROSS_TENANT row(s)`);
    }
    return unexpected;
  }

  private async buildRun(
    mode: BackfillMode,
    operator: string,
    proposals: ActivityBackfillProposal[],
    _applied: boolean
  ): Promise<BackfillRunState> {
    const runId = randomUUID();
    const census = this.summarizeCensus(proposals);
    const manifest: ManifestRecord[] = proposals
      .filter((p) => p.validation_result === 'AUTO_SAFE')
      .map((p) => ({
        activityId: p.activityId,
        organizationId: p.organizationId,
        workpackId: p.workpackId,
        fieldsChanged: p.fields
          .filter((f) => f.decision === 'AUTO_SAFE' && f.oldValue !== f.proposedValue)
          .map((f) => f.field),
        oldValues: {
          event_id: p.old_event_id,
          discipline_id: p.old_discipline_id,
          standard_activity_type_id: p.old_standard_activity_type_id,
        },
        newValues: {
          event_id: p.proposed_event_id,
          discipline_id: p.proposed_discipline_id,
          standard_activity_type_id: p.proposed_standard_activity_type_id,
        },
        derivationSource: p.derivation_reason,
        classification: p.classification,
        validationResult: p.validation_result,
        rowHashBefore: p.row_hash_before,
        timestamp: new Date().toISOString(),
        runId,
        applied: false,
        rolledBack: false,
      }));

    const summary: BackfillRunSummary = {
      runId,
      mode,
      environment: this.db.environmentName(),
      database: await this.db.databaseName(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      operator,
      census,
      totalCandidates: manifest.length,
      safeEventBackfills: proposals.filter((p) =>
        p.fields.some((f) => f.field === 'event_id' && f.decision === 'AUTO_SAFE')
      ).length,
      safeDisciplineBackfills: proposals.filter((p) =>
        p.fields.some((f) => f.field === 'discipline_id' && f.decision === 'AUTO_SAFE')
      ).length,
      safeSatBackfills: proposals.filter((p) =>
        p.fields.some((f) => f.field === 'standard_activity_type_id' && f.decision === 'AUTO_SAFE')
      ).length,
      ambiguous: proposals.filter((p) =>
        p.classification.some((c) => c === 'DISCIPLINE_AMBIGUOUS' || c === 'SAT_AMBIGUOUS')
      ).length,
      unresolved: proposals.filter((p) =>
        p.classification.some((c) => c === 'EVENT_UNRESOLVED' || c === 'DISCIPLINE_UNRESOLVED' || c === 'SAT_UNRESOLVED')
      ).length,
      contradictory: proposals.filter((p) => p.classification.includes('EVENT_CONTRADICTION')).length,
      crossTenant: proposals.filter((p) =>
        p.classification.includes('CROSS_TENANT_WORKPACK') || p.classification.includes('CROSS_TENANT_RELATIONSHIP')
      ).length,
      loose: proposals.filter((p) => p.classification.includes('LOOSE_ACTIVITY')).length,
      legacy: proposals.filter((p) => p.classification.includes('LEGACY_IMPORTED')).length,
      applied: 0,
      rolledBack: 0,
      unexpectedRelationships: this.detectUnexpected(proposals),
    };

    return { summary, proposals, manifest };
  }
}

export function reproduceFromManifest(manifest: ManifestRecord[]): IdentityValues[] {
  return manifest.map((m) => (m.rolledBack || !m.applied ? m.oldValues : m.newValues));
}
