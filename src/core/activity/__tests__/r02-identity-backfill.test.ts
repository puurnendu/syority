import { describe, expect, it } from 'vitest';
import { ActivityIdentityBackfillService, reproduceFromManifest } from '../ActivityIdentityBackfillService';
import type {
  ActivityIdentityRow,
  BackfillDatabase,
  IdentityValues,
  WorkpackIdentityRow,
} from '../identityBackfillTypes';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const EVT_2027 = 'e2027000-0000-4000-8000-000000002027';
const EVT_2028 = 'e2028000-0000-4000-8000-000000002028';
const WP_A = 'w1111111-1111-4111-8111-111111111111';
const WP_NULL_EVENT = 'w2222222-2222-4222-8222-222222222222';
const WP_B = 'wbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WP_SYS = 'w3333333-3333-4333-8333-333333333333';
const DISC_MECH = 'dmech000-0000-4000-8000-000000000001';
const SAT_BPULL = 'sat-bpull-0000-4000-8000-000000000001';
const EQ_HEX = 'hex-st';
const LIB_ACT = 'lib-act-0000-4000-8000-000000000001';
const LIB_BPULL = 'lib-bpull-0000-4000-8000-000000000002';
const UNIT_A = 'u1111111-1111-4111-8111-111111111111';
const PLANT_A = 'p1111111-1111-4111-8111-111111111111';

function activity(partial: Partial<ActivityIdentityRow> & { id: string }): ActivityIdentityRow {
  return {
    organization_id: ORG_A,
    site_id: 's1',
    workpack_id: WP_A,
    event_id: null,
    activity_library_id: null,
    activity_number: null,
    activity_id: null,
    description: 'Test',
    discipline_id: null,
    standard_activity_type_id: null,
    p6_object_id: null,
    p6_activity_id: null,
    deleted_at: null,
    ...partial,
  };
}

function workpack(partial: Partial<WorkpackIdentityRow> & { id: string }): WorkpackIdentityRow {
  return {
    organization_id: ORG_A,
    event_id: EVT_2027,
    discipline_id: DISC_MECH,
    asset_id: null,
    unit_id: null,
    plant_id: null,
    system_id: null,
    equipment_type: null,
    template_id: null,
    deleted_at: null,
    ...partial,
  };
}

class MemoryStore implements BackfillDatabase {
  activities: ActivityIdentityRow[] = [];
  workpacks: WorkpackIdentityRow[] = [];
  events = [
    { id: EVT_2027, organization_id: ORG_A, deleted_at: null },
    { id: EVT_2028, organization_id: ORG_A, deleted_at: null },
  ];
  disciplines = [
    { id: DISC_MECH, organization_id: ORG_A, code: 'MECH', is_active: true },
    { id: 'd-amb-1', organization_id: ORG_A, code: 'MECH-A', is_active: true },
    { id: 'd-amb-2', organization_id: ORG_A, code: 'MECH-B', is_active: true },
    { id: 'd-b', organization_id: ORG_B, code: 'MECH', is_active: true },
  ];
  assets = [
    {
      id: 'asset-hx',
      organization_id: ORG_A,
      equipment_type_id: EQ_HEX,
      plant_id: PLANT_A,
      unit_id: UNIT_A,
      system_id: null as string | null,
    },
  ];
  units = [{ id: UNIT_A, organization_id: ORG_A, plant_id: PLANT_A, area_id: null as string | null }];
  systems: Array<{ id: string; organization_id: string; unit_id: string | null }> = [];
  libraries = [
    { id: LIB_ACT, organization_id: ORG_A, activity_code: 'ACT-MECH-0010' },
    { id: LIB_BPULL, organization_id: ORG_A, activity_code: 'BPULL' },
  ];
  templates: Array<{ id: string; organization_id: string | null; discipline_id: string | null; equipment_type: string | null }> = [];
  sats = [
    { id: SAT_BPULL, code: 'BPULL', equipment_type_id: EQ_HEX },
    { id: 'sat-dup-1', code: 'CLEAN', equipment_type_id: EQ_HEX },
    { id: 'sat-dup-2', code: 'CLEAN', equipment_type_id: EQ_HEX },
  ];
  equipmentTypes = [{ id: EQ_HEX, code: 'HEX-ST' }];
  audits: unknown[] = [];

  environmentName() {
    return 'test';
  }
  async databaseName() {
    return 'memory';
  }
  async loadActivities() {
    return this.activities;
  }
  async loadWorkpacks(ids: string[]) {
    return this.workpacks.filter((w) => ids.includes(w.id));
  }
  async loadEvents(ids: string[]) {
    return this.events.filter((e) => ids.includes(e.id));
  }
  async loadDisciplines(ids: string[]) {
    return this.disciplines.filter((d) => ids.includes(d.id));
  }
  async loadAssets(ids: string[]) {
    return this.assets.filter((a) => ids.includes(a.id));
  }
  async loadUnits(ids: string[]) {
    return this.units.filter((u) => ids.includes(u.id));
  }
  async loadSystems(ids: string[]) {
    return this.systems.filter((s) => ids.includes(s.id));
  }
  async loadLibraries(ids: string[]) {
    return this.libraries.filter((l) => ids.includes(l.id));
  }
  async loadTemplates(ids: string[]) {
    return this.templates.filter((t) => ids.includes(t.id));
  }
  async loadStandardActivities(equipmentTypeId: string, ref: string) {
    const clean = ref.toLowerCase();
    return this.sats.filter(
      (s) => s.equipment_type_id === equipmentTypeId && (s.id === ref || s.code.toLowerCase() === clean)
    );
  }
  async loadStandardActivityById(id: string) {
    return this.sats.find((s) => s.id === id) ?? null;
  }
  async loadEquipmentTypes(ref: string) {
    const clean = ref.toLowerCase();
    return this.equipmentTypes.filter((e) => e.id === ref || e.code.toLowerCase() === clean);
  }
  async updateActivityIdentity(id: string, org: string, expected: IdentityValues, next: IdentityValues) {
    const row = this.activities.find((a) => a.id === id && a.organization_id === org);
    if (!row) return false;
    if (
      row.event_id !== expected.event_id ||
      row.discipline_id !== expected.discipline_id ||
      row.standard_activity_type_id !== expected.standard_activity_type_id
    ) {
      return false;
    }
    row.event_id = next.event_id;
    row.discipline_id = next.discipline_id;
    row.standard_activity_type_id = next.standard_activity_type_id;
    return true;
  }
  async writeAudit(entry: unknown) {
    this.audits.push(entry);
  }
}

function service(store: MemoryStore) {
  return new ActivityIdentityBackfillService(store);
}

describe('R0.2 Activity identity backfill', () => {
  it('R02-01 null Activity.event_id + valid Workpack.event_id is AUTO_SAFE', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A })];
    store.activities = [activity({ id: 'act-1', event_id: null, workpack_id: WP_A })];
    const { proposals } = await service(store).census();
    expect(proposals[0].validation_result).toBe('AUTO_SAFE');
    expect(proposals[0].proposed_event_id).toBe(EVT_2027);
    expect(proposals[0].old_event_id).toBeNull();
  });

  it('R02-02 null event + workpack event null is unresolved and not updated', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_NULL_EVENT, event_id: null, discipline_id: null })];
    store.activities = [activity({ id: 'act-2', workpack_id: WP_NULL_EVENT, event_id: null })];
    const before = store.activities[0].event_id;
    const run = await service(store).apply('test');
    expect(run.proposals[0].classification).toContain('EVENT_UNRESOLVED');
    expect(run.summary.applied).toBe(0);
    expect(store.activities[0].event_id).toBe(before);
  });

  it('R02-03 matching event is unchanged', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, discipline_id: null })];
    store.activities = [activity({ id: 'act-3', event_id: EVT_2027, workpack_id: WP_A })];
    const { proposals } = await service(store).census();
    expect(proposals[0].classification).toContain('EVENT_AGREES');
    expect(proposals[0].validation_result).toBe('UNCHANGED');
    expect(proposals[0].proposed_event_id).toBe(EVT_2027);
  });

  it('R02-04 conflicting event is not overwritten', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, event_id: EVT_2027, discipline_id: null })];
    store.activities = [activity({ id: 'act-4', event_id: EVT_2028, workpack_id: WP_A })];
    const run = await service(store).dryRun();
    expect(run.proposals[0].classification).toContain('EVENT_CONTRADICTION');
    expect(run.proposals[0].proposed_event_id).toBe(EVT_2028);
    expect(run.summary.unexpectedRelationships.length).toBeGreaterThan(0);
    await expect(service(store).apply('test')).rejects.toThrow(/EVENT_CONTRADICTION/);
    expect(store.activities[0].event_id).toBe(EVT_2028);
  });

  it('R02-05 cross-tenant workpack is rejected', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_B, organization_id: ORG_B })];
    store.activities = [activity({ id: 'act-5', workpack_id: WP_B })];
    const run = await service(store).dryRun();
    expect(run.proposals[0].classification).toContain('CROSS_TENANT_WORKPACK');
    expect(store.activities[0].event_id).toBeNull();
    await expect(service(store).apply('test')).rejects.toThrow(/CROSS_TENANT/);
    expect(store.activities[0].event_id).toBeNull();
  });

  it('R02-06 unique workpack discipline is a backfill candidate', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, event_id: EVT_2027, discipline_id: DISC_MECH })];
    store.activities = [activity({ id: 'act-6', workpack_id: WP_A, discipline_id: null, event_id: EVT_2027 })];
    const { proposals } = await service(store).census();
    expect(proposals[0].proposed_discipline_id).toBe(DISC_MECH);
    expect(proposals[0].fields.find((f) => f.field === 'discipline_id')?.decision).toBe('AUTO_SAFE');
  });

  it('R02-07 dangling / non-unique discipline is not updated', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, discipline_id: 'missing-disc', event_id: EVT_2027 })];
    store.activities = [activity({ id: 'act-7', event_id: EVT_2027, discipline_id: null })];
    const run = await service(store).apply('test');
    expect(run.proposals[0].classification).toContain('DISCIPLINE_AMBIGUOUS');
    expect(store.activities[0].discipline_id).toBeNull();
  });

  it('R02-08 unique SAT from library code + equipment type is AUTO_SAFE', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, asset_id: 'asset-hx', discipline_id: null })];
    store.activities = [
      activity({
        id: 'act-8',
        event_id: EVT_2027,
        activity_library_id: LIB_BPULL,
      }),
    ];
    const { proposals } = await service(store).census();
    expect(proposals[0].proposed_standard_activity_type_id).toBe(SAT_BPULL);
    expect(proposals[0].fields.find((f) => f.field === 'standard_activity_type_id')?.decision).toBe('AUTO_SAFE');
  });

  it('R02-09 library ACT-* code is not mapped to SAT', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, asset_id: 'asset-hx', discipline_id: null })];
    store.activities = [
      activity({ id: 'act-9', event_id: EVT_2027, activity_library_id: LIB_ACT }),
    ];
    const run = await service(store).apply('test');
    expect(run.proposals[0].classification).toContain('LIBRARY_CODE_NOT_SAT');
    expect(store.activities[0].standard_activity_type_id).toBeNull();
  });

  it('R02-10 ambiguous SAT is not updated', async () => {
    const store = new MemoryStore();
    store.libraries.push({ id: 'lib-clean', organization_id: ORG_A, activity_code: 'CLEAN' });
    store.workpacks = [workpack({ id: WP_A, asset_id: 'asset-hx', discipline_id: null })];
    store.activities = [
      activity({ id: 'act-10', event_id: EVT_2027, activity_library_id: 'lib-clean' }),
    ];
    const run = await service(store).apply('test');
    expect(run.proposals[0].classification).toContain('SAT_AMBIGUOUS');
    expect(store.activities[0].standard_activity_type_id).toBeNull();
  });

  it('R02-11 system-level activity does not invent asset_id', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_SYS, asset_id: null, discipline_id: null })];
    store.activities = [activity({ id: 'act-11', workpack_id: WP_SYS })];
    const run = await service(store).apply('test');
    expect(store.activities[0]).not.toHaveProperty('asset_id');
    expect((store.activities[0] as ActivityIdentityRow & { asset_id?: string }).asset_id).toBeUndefined();
    expect(run.manifest[0].newValues).not.toHaveProperty('asset_id');
  });

  it('R02-12 loose activity does not guess event from project_id', async () => {
    const store = new MemoryStore();
    store.activities = [
      activity({
        id: 'act-12',
        workpack_id: null,
        event_id: null,
        project_id: EVT_2027,
      }),
    ];
    const run = await service(store).apply('test');
    expect(run.proposals[0].classification).toContain('LOOSE_ACTIVITY');
    expect(store.activities[0].event_id).toBeNull();
  });

  it('R02-13 soft-deleted activity is excluded', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A })];
    store.activities = [activity({ id: 'act-13', deleted_at: new Date().toISOString() })];
    const run = await service(store).apply('test');
    expect(run.proposals[0].classification).toContain('SOFT_DELETED');
    expect(store.activities[0].event_id).toBeNull();
    expect(run.summary.applied).toBe(0);
  });

  it('R02-14 tenant A cannot take tenant B discipline', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A, discipline_id: 'd-b', event_id: EVT_2027 })];
    store.activities = [activity({ id: 'act-14', event_id: EVT_2027, discipline_id: null })];
    const run = await service(store).apply('test');
    expect(store.activities[0].discipline_id).toBeNull();
    expect(run.proposals[0].classification).toContain('DISCIPLINE_INVALID');
  });

  it('R02-15 rollback restores previous values from the manifest', async () => {
    const store = new MemoryStore();
    store.workpacks = [workpack({ id: WP_A })];
    store.activities = [activity({ id: 'act-15', event_id: null, discipline_id: null })];
    const svc = service(store);
    const applied = await svc.apply('test');
    expect(store.activities[0].event_id).toBe(EVT_2027);
    expect(store.activities[0].discipline_id).toBe(DISC_MECH);
    expect(applied.summary.applied).toBe(1);
    const rolled = await svc.rollback(applied, 'test');
    expect(store.activities[0].event_id).toBeNull();
    expect(store.activities[0].discipline_id).toBeNull();
    expect(rolled.summary.rolledBack).toBe(1);
    expect(reproduceFromManifest(rolled.manifest)[0]).toEqual({
      event_id: null,
      discipline_id: null,
      standard_activity_type_id: null,
    });
  });

  it('R02-16 post-apply invariants: no contradiction, no cross-tenant write, hashes match', async () => {
    const store = new MemoryStore();
    store.workpacks = [
      workpack({ id: WP_A }),
      workpack({ id: WP_NULL_EVENT, event_id: null, discipline_id: null }),
    ];
    store.activities = [
      activity({ id: 'act-16a', workpack_id: WP_A }),
      activity({ id: 'act-16b', workpack_id: WP_NULL_EVENT }),
      activity({ id: 'act-16c', workpack_id: WP_A, event_id: EVT_2027, discipline_id: DISC_MECH }),
    ];
    const svc = service(store);
    const applied = await svc.apply('test');
    const after = await svc.census();
    expect(after.counts.event_contradiction).toBe(0);
    expect(after.counts.workpack_cross_tenant).toBe(0);
    expect(store.activities.find((a) => a.id === 'act-16a')?.event_id).toBe(EVT_2027);
    expect(store.activities.find((a) => a.id === 'act-16b')?.event_id).toBeNull();
    expect(store.activities.find((a) => a.id === 'act-16c')?.event_id).toBe(EVT_2027);
    expect(applied.manifest.every((m) => m.applied && m.rowHashAfter)).toBe(true);
    expect(applied.summary.unexpectedRelationships).toEqual([]);
  });
});
