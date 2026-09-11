/**
 * Raw-SQL store so R0.2 does not SELECT Prisma schema columns that are absent from the
 * live database.
 *
 * OD9.1: `schedule_source` now exists physically (Phase 3B) and IS selected. It was
 * omitted from loadActivities while the column did not exist, which silently disabled
 * the `schedule_source === 'imported'` arm of the legacy test in
 * ActivityIdentityBackfillService.isLegacy — the field was always undefined, so that
 * condition could never evaluate true and legacy detection fell back to the p6_* columns
 * alone. `project_id` remains unselected because OD9.1 retired it entirely.
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  ActivityIdentityRow,
  BackfillDatabase,
  IdentityValues,
  WorkpackIdentityRow,
} from './identityBackfillTypes';
import { R02_SOURCE } from './identityBackfillTypes';

type SqlClient = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>;

function inList(ids: string[]): string[] {
  return ids.filter(Boolean);
}

export class PrismaIdentityBackfillStore implements BackfillDatabase {
  private workpackColumns: Set<string> | null = null;

  constructor(
    private readonly db: SqlClient,
    private readonly envName = process.env.NODE_ENV ?? 'development'
  ) {}

  private async workpackHas(column: string): Promise<boolean> {
    if (!this.workpackColumns) {
      const rows = await this.db.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Workpack'
      `;
      this.workpackColumns = new Set(rows.map((r) => r.column_name));
    }
    return this.workpackColumns.has(column);
  }

  environmentName(): string {
    return this.envName;
  }

  async databaseName(): Promise<string> {
    const rows = await this.db.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    return rows[0]?.current_database ?? 'unknown';
  }

  async loadActivities(): Promise<ActivityIdentityRow[]> {
    return this.db.$queryRaw<ActivityIdentityRow[]>`
      SELECT
        id, organization_id, site_id, workpack_id, event_id, activity_library_id,
        activity_number, activity_id, description, discipline_id, standard_activity_type_id,
        p6_object_id, p6_activity_id, schedule_source, deleted_at, created_at, updated_at
      FROM "Activity"
    `;
  }

  async loadWorkpacks(ids: string[]): Promise<WorkpackIdentityRow[]> {
    const list = inList(ids);
    if (list.length === 0) return [];
    const cols = [
      'id',
      'organization_id',
      'event_id',
      'discipline_id',
      'asset_id',
      'unit_id',
      'plant_id',
      'system_id',
      'equipment_type',
      'template_id',
      'deleted_at',
    ];
    const present: string[] = [];
    for (const col of cols) {
      if (col === 'id' || col === 'organization_id' || (await this.workpackHas(col))) present.push(col);
    }
    const selectList = cols
      .map((col) => (present.includes(col) ? `"${col}"` : `NULL AS "${col}"`))
      .join(', ');
    return this.db.$queryRawUnsafe<WorkpackIdentityRow[]>(
      `SELECT ${selectList} FROM "Workpack" WHERE id = ANY($1::uuid[])`,
      list
    );
  }

  async loadEvents(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{ id: string; organization_id: string; deleted_at: Date | null }>>`
      SELECT id, organization_id, deleted_at
      FROM events
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadDisciplines(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{ id: string; organization_id: string; code: string; is_active: boolean | null }>>`
      SELECT id, organization_id, code, is_active
      FROM "Discipline"
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadAssets(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{
      id: string;
      organization_id: string;
      equipment_type_id: string | null;
      plant_id: string | null;
      unit_id: string | null;
      system_id: string | null;
    }>>`
      SELECT id, organization_id, equipment_type_id, plant_id, unit_id, system_id
      FROM "Asset"
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadUnits(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{ id: string; organization_id: string; plant_id: string | null; area_id: string | null }>>`
      SELECT id, organization_id, plant_id, area_id
      FROM "Unit"
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadSystems(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{ id: string; organization_id: string; unit_id: string | null }>>`
      SELECT id, organization_id, unit_id
      FROM "System"
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadLibraries(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{ id: string; organization_id: string; activity_code: string | null }>>`
      SELECT id, organization_id, activity_code
      FROM "ActivityLibrary"
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadTemplates(ids: string[]) {
    const list = inList(ids);
    if (list.length === 0) return [];
    return this.db.$queryRaw<Array<{ id: string; organization_id: string | null; discipline_id: string | null; equipment_type: string | null }>>`
      SELECT id, organization_id, discipline_id, equipment_type
      FROM workpack_templates
      WHERE id = ANY(${list}::uuid[])
    `;
  }

  async loadStandardActivities(equipmentTypeId: string, ref: string) {
    return this.db.$queryRaw<Array<{ id: string; code: string; equipment_type_id: string }>>`
      SELECT id, code, equipment_type_id
      FROM standard_activity_types
      WHERE equipment_type_id = ${equipmentTypeId}
        AND is_active = true
        AND (id::text = ${ref} OR lower(code) = lower(${ref}))
    `;
  }

  async loadStandardActivityById(id: string) {
    const rows = await this.db.$queryRaw<Array<{ id: string; code: string; equipment_type_id: string }>>`
      SELECT id, code, equipment_type_id
      FROM standard_activity_types
      WHERE id = ${id}::uuid
    `;
    return rows[0] ?? null;
  }

  async loadEquipmentTypes(ref: string) {
    return this.db.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT id, code
      FROM "EquipmentType"
      WHERE is_active = true
        AND (id = ${ref} OR lower(code) = lower(${ref}))
    `;
  }

  async updateActivityIdentity(
    activityId: string,
    organizationId: string,
    expectedOld: IdentityValues,
    next: IdentityValues
  ): Promise<boolean> {
    const result = await this.db.$executeRaw`
      UPDATE "Activity"
      SET
        event_id = ${next.event_id}::uuid,
        discipline_id = ${next.discipline_id}::uuid,
        standard_activity_type_id = ${next.standard_activity_type_id}::uuid,
        updated_at = NOW()
      WHERE id = ${activityId}::uuid
        AND organization_id = ${organizationId}::uuid
        AND event_id IS NOT DISTINCT FROM ${expectedOld.event_id}::uuid
        AND discipline_id IS NOT DISTINCT FROM ${expectedOld.discipline_id}::uuid
        AND standard_activity_type_id IS NOT DISTINCT FROM ${expectedOld.standard_activity_type_id}::uuid
    `;
    return Number(result) === 1;
  }

  async writeAudit(entry: {
    organizationId: string;
    activityId: string;
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  }): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO "AuditLog" (
        id, organization_id, auditable_type, auditable_id, event, old_values, new_values, context, created_at
      ) VALUES (
        ${randomUUID()}::uuid,
        ${entry.organizationId}::uuid,
        'Activity',
        ${entry.activityId}::uuid,
        'updated',
        ${JSON.stringify(entry.oldValues)}::jsonb,
        ${JSON.stringify(entry.newValues)}::jsonb,
        ${R02_SOURCE},
        NOW()
      )
    `;
  }
}
