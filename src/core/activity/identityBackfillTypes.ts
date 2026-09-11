export const R02_SOURCE = 'R0.2_IDENTITY_BACKFILL';

export type BackfillMode = 'census' | 'dry_run' | 'apply' | 'rollback';

export type FieldDecision =
  | 'AUTO_SAFE'
  | 'UNCHANGED'
  | 'EVENT_UNRESOLVED'
  | 'EVENT_CONTRADICTION'
  | 'EVENT_AGREES'
  | 'DISCIPLINE_AMBIGUOUS'
  | 'DISCIPLINE_UNRESOLVED'
  | 'DISCIPLINE_INVALID'
  | 'SAT_AMBIGUOUS'
  | 'SAT_UNRESOLVED'
  | 'LIBRARY_CODE_NOT_SAT'
  | 'CROSS_TENANT_RELATIONSHIP'
  | 'CROSS_TENANT_WORKPACK'
  | 'INVALID_HIERARCHY'
  | 'LOOSE_ACTIVITY'
  | 'LEGACY_IMPORTED'
  | 'SOFT_DELETED'
  | 'WORKPACK_MISSING'
  | 'EXCLUDED';

export interface ActivityIdentityRow {
  id: string;
  organization_id: string;
  site_id: string;
  workpack_id: string | null;
  event_id: string | null;
  activity_library_id: string | null;
  activity_number: string | null;
  activity_id: string | null;
  description: string;
  discipline_id: string | null;
  standard_activity_type_id: string | null;
  p6_object_id: number | null;
  p6_activity_id: string | null;
  project_id?: string | null;
  schedule_source?: string | null;
  deleted_at: Date | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export interface WorkpackIdentityRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  discipline_id: string | null;
  asset_id: string | null;
  unit_id: string | null;
  plant_id: string | null;
  system_id: string | null;
  equipment_type: string | null;
  template_id: string | null;
  deleted_at: Date | string | null;
}

export interface IdentityValues {
  event_id: string | null;
  discipline_id: string | null;
  standard_activity_type_id: string | null;
}

export interface FieldProposal {
  field: keyof IdentityValues;
  oldValue: string | null;
  proposedValue: string | null;
  decision: FieldDecision;
  derivationReason: string;
}

export interface ActivityBackfillProposal {
  activityId: string;
  workpackId: string | null;
  organizationId: string;
  old_event_id: string | null;
  proposed_event_id: string | null;
  old_discipline_id: string | null;
  proposed_discipline_id: string | null;
  old_standard_activity_type_id: string | null;
  proposed_standard_activity_type_id: string | null;
  derivation_reason: string;
  validation_result: 'AUTO_SAFE' | 'QUARANTINED' | 'UNCHANGED';
  classification: FieldDecision[];
  fields: FieldProposal[];
  row_hash_before: string;
  excluded: boolean;
  excludeReason: string | null;
}

export interface CensusCounts {
  activities_total: number;
  live: number;
  soft_deleted: number;
  missing_event_id: number;
  valid_event_id: number;
  event_agrees_with_workpack: number;
  event_contradiction: number;
  event_deterministic_candidate: number;
  event_unresolved: number;
  workpack_missing: number;
  workpack_cross_tenant: number;
  workpack_event_missing: number;
  missing_discipline: number;
  valid_discipline: number;
  discipline_invalid_or_cross_tenant: number;
  discipline_deterministic_candidate: number;
  missing_sat: number;
  valid_sat: number;
  sat_invalid: number;
  sat_uniquely_derivable: number;
  sat_ambiguous: number;
  sat_not_derivable: number;
  library_code_not_sat: number;
  equipment_type_context_missing: number;
  hierarchy_inconsistent: number;
  loose_activities: number;
  legacy_imported: number;
  cross_tenant: number;
}

export interface BackfillRunSummary {
  runId: string;
  mode: BackfillMode;
  environment: string;
  database?: string;
  startedAt: string;
  completedAt: string;
  operator: string;
  census: CensusCounts;
  totalCandidates: number;
  safeEventBackfills: number;
  safeDisciplineBackfills: number;
  safeSatBackfills: number;
  ambiguous: number;
  unresolved: number;
  contradictory: number;
  crossTenant: number;
  loose: number;
  legacy: number;
  applied: number;
  rolledBack: number;
  unexpectedRelationships: string[];
}

export interface ManifestRecord {
  activityId: string;
  organizationId: string;
  workpackId: string | null;
  fieldsChanged: (keyof IdentityValues)[];
  oldValues: IdentityValues;
  newValues: IdentityValues;
  derivationSource: string;
  classification: FieldDecision[];
  validationResult: ActivityBackfillProposal['validation_result'];
  rowHashBefore: string;
  rowHashAfter?: string;
  timestamp: string;
  runId: string;
  applied: boolean;
  rolledBack: boolean;
}

export interface BackfillDatabase {
  environmentName(): string;
  databaseName(): Promise<string>;
  loadActivities(): Promise<ActivityIdentityRow[]>;
  loadWorkpacks(ids: string[]): Promise<WorkpackIdentityRow[]>;
  loadEvents(ids: string[]): Promise<Array<{ id: string; organization_id: string; deleted_at: Date | string | null }>>;
  loadDisciplines(ids: string[]): Promise<Array<{ id: string; organization_id: string; code: string; is_active: boolean | null }>>;
  loadAssets(ids: string[]): Promise<Array<{
    id: string;
    organization_id: string;
    equipment_type_id: string | null;
    plant_id: string | null;
    unit_id: string | null;
    system_id: string | null;
  }>>;
  loadUnits(ids: string[]): Promise<Array<{ id: string; organization_id: string; plant_id: string | null; area_id: string | null }>>;
  loadSystems(ids: string[]): Promise<Array<{ id: string; organization_id: string; unit_id: string | null }>>;
  loadLibraries(ids: string[]): Promise<Array<{ id: string; organization_id: string; activity_code: string | null }>>;
  loadTemplates(ids: string[]): Promise<Array<{ id: string; organization_id: string | null; discipline_id: string | null; equipment_type: string | null }>>;
  loadStandardActivities(equipmentTypeId: string, ref: string): Promise<Array<{ id: string; code: string; equipment_type_id: string }>>;
  loadStandardActivityById(id: string): Promise<{ id: string; code: string; equipment_type_id: string } | null>;
  loadEquipmentTypes(ref: string): Promise<Array<{ id: string; code: string }>>;
  updateActivityIdentity(
    activityId: string,
    organizationId: string,
    expectedOld: IdentityValues,
    next: IdentityValues
  ): Promise<boolean>;
  writeAudit(entry: {
    organizationId: string;
    activityId: string;
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  }): Promise<void>;
}
