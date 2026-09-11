/**
 * R0.1 behavioural tests — Activity identity creation authority.
 * These execute the command. They do not grep source for field names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createActivity } from '../ActivityCreationCommand';
import { ActivityIdentityError } from '../ActivityIdentityError';
import { ControlledValidationError } from '@/core/governance/ControlledValueResolver';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SITE_A = 's1111111-1111-4111-8111-111111111111';
const EVENT_2027 = 'e2027000-0000-4000-8000-000000002027';
const EVENT_2028 = 'e2028000-0000-4000-8000-000000002028';
const WP_EQUIP = 'w1111111-1111-4111-8111-111111111111';
const WP_SYSTEM = 'w2222222-2222-4222-8222-222222222222';
const WP_B = 'wbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ASSET_HX = 'a2040000-0000-4000-8000-000000000204';
const DISC_MECH = 'dmech000-0000-4000-8000-000000000001';
const EQ_HEX = 'hex-st';
const SAT_BPULL = 'sat-bpull-0000-4000-8000-000000000001';
const PLANT_A = 'p1111111-1111-4111-8111-111111111111';
const UNIT_A = 'u1111111-1111-4111-8111-111111111111';
const SYSTEM_A = 'y1111111-1111-4111-8111-111111111111';
const TPL_ID = 't1111111-1111-4111-8111-111111111111';

type Row = Record<string, any>;

const store: {
  activities: Row[];
  workpacks: Row[];
  events: Row[];
  disciplines: Row[];
  equipmentTypes: Row[];
  sats: Row[];
  assets: Row[];
  units: Row[];
  systems: Row[];
  sites: Row[];
  audits: Row[];
} = {
  activities: [],
  workpacks: [],
  events: [],
  disciplines: [],
  equipmentTypes: [],
  sats: [],
  assets: [],
  units: [],
  systems: [],
  sites: [],
  audits: [],
};

function seedFixtures() {
  store.activities = [];
  store.audits = [];
  store.sites = [{ id: SITE_A, organization_id: ORG_A, is_active: true }];
  store.events = [
    { id: EVENT_2027, organization_id: ORG_A, site_id: SITE_A, code: 'TA-2027', deleted_at: null },
    { id: EVENT_2028, organization_id: ORG_A, site_id: SITE_A, code: 'TA-2028', deleted_at: null },
  ];
  store.disciplines = [
    { id: DISC_MECH, organization_id: ORG_A, code: 'MECH', name: 'Mechanical', is_active: true },
  ];
  store.equipmentTypes = [
    { id: EQ_HEX, code: 'HEX-ST', name: 'Shell & Tube Heat Exchanger', is_active: true },
  ];
  store.sats = [
    {
      id: SAT_BPULL,
      equipment_type_id: EQ_HEX,
      code: 'BPULL',
      name: 'Bundle Pullout',
      is_active: true,
    },
  ];
  store.assets = [
    {
      id: ASSET_HX,
      organization_id: ORG_A,
      tag_number: 'HX-204',
      equipment_type_id: EQ_HEX,
      plant_id: PLANT_A,
      unit_id: UNIT_A,
      system_id: SYSTEM_A,
      is_active: true,
      equipment_type_rel: store.equipmentTypes[0],
      plant: { id: PLANT_A },
      unit: { id: UNIT_A },
      system: { id: SYSTEM_A },
    },
  ];
  store.units = [{ id: UNIT_A, organization_id: ORG_A, plant_id: PLANT_A, area_id: null, name: 'U1', code: 'U1' }];
  store.systems = [{ id: SYSTEM_A, organization_id: ORG_A, unit_id: UNIT_A, name: 'S1', code: 'S1' }];
  store.workpacks = [
    {
      id: WP_EQUIP,
      organization_id: ORG_A,
      site_id: SITE_A,
      event_id: EVENT_2027,
      discipline_id: DISC_MECH,
      asset_id: ASSET_HX,
      unit_id: UNIT_A,
      plant_id: PLANT_A,
      system_id: SYSTEM_A,
      contractor_id: null,
      equipment_type: 'HEX-ST',
      workpack_number: 'WP-2027-00001',
      deleted_at: null,
      asset: store.assets[0],
    },
    {
      id: WP_SYSTEM,
      organization_id: ORG_A,
      site_id: SITE_A,
      event_id: EVENT_2027,
      discipline_id: DISC_MECH,
      asset_id: null,
      unit_id: UNIT_A,
      plant_id: PLANT_A,
      system_id: SYSTEM_A,
      contractor_id: null,
      equipment_type: null,
      workpack_number: 'WP-2027-00002',
      deleted_at: null,
      asset: null,
    },
    {
      id: WP_B,
      organization_id: ORG_B,
      site_id: SITE_A,
      event_id: EVENT_2027,
      discipline_id: null,
      asset_id: null,
      unit_id: null,
      plant_id: null,
      system_id: null,
      contractor_id: null,
      equipment_type: null,
      workpack_number: 'WP-B-1',
      deleted_at: null,
      asset: null,
    },
  ];
}

function matchById(rows: Row[], where: any) {
  if (!where) return rows[0] ?? null;
  return (
    rows.find((row) => {
      if (where.id && row.id !== where.id) return false;
      if (where.organization_id && row.organization_id !== where.organization_id) return false;
      if (where.deleted_at === null && row.deleted_at) return false;
      if (where.equipment_type_id && row.equipment_type_id !== where.equipment_type_id) return false;
      if (where.is_active === true && row.is_active === false) return false;
      if (where.OR) {
        const orHit = where.OR.some((clause: any) => {
          if (clause.id && row.id === clause.id) return true;
          if (clause.code?.equals && String(row.code).toLowerCase() === String(clause.code.equals).toLowerCase()) {
            return true;
          }
          if (clause.id === clause.id && clause.id && row.id === clause.id) return true;
          return false;
        });
        if (!orHit) return false;
      }
      return true;
    }) ?? null
  );
}

vi.mock('@/lib/prisma', () => {
  const client: any = {
    workpack: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.workpacks, where)),
      findUnique: vi.fn(async ({ where }: any) => store.workpacks.find((w) => w.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const wp = store.workpacks.find((w) => w.id === where.id);
        if (wp) Object.assign(wp, data);
        return wp;
      }),
    },
    event: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.events, where)),
    },
    site: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.sites, where)),
    },
    scopeItem: {
      findFirst: vi.fn(async () => null),
    },
    activity: {
      aggregate: vi.fn(async ({ where }: any) => {
        const scoped = store.activities.filter((a) => {
          if (where.workpack_id && a.workpack_id !== where.workpack_id) return false;
          if (where.event_id && a.event_id !== where.event_id) return false;
          return !a.deleted_at;
        });
        const max = scoped.reduce((m, a) => Math.max(m, a.sequence_number ?? 0), 0);
        return { _max: { sequence_number: max || null } };
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data };
        store.activities.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        store.activities.filter((a) => {
          if (where?.workpack_id && a.workpack_id !== where.workpack_id) return false;
          if (where?.organization_id && a.organization_id !== where.organization_id) return false;
          return !a.deleted_at;
        })
      ),
    },
    activity_code_default_resources: {
      findMany: vi.fn(async () => []),
    },
    activityResource: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    activityLibrary: {
      findFirst: vi.fn(async () => null),
    },
    activityRelationship: {
      create: vi.fn(async ({ data }: any) => data),
    },
    discipline: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.disciplines, where)),
    },
    equipmentType: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.equipmentTypes, where)),
    },
    standardActivityType: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.sats, where)),
      findMany: vi.fn(async () => store.sats),
    },
    asset: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.assets, where)),
    },
    contractor: {
      findFirst: vi.fn(async () => null),
    },
    unit: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.units, where)),
    },
    system: {
      findFirst: vi.fn(async ({ where }: any) => matchById(store.systems, where)),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        store.audits.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (fn: any) => {
      const snapshot = JSON.parse(JSON.stringify(store.activities));
      try {
        return await fn(client);
      } catch (error) {
        store.activities.splice(0, store.activities.length, ...snapshot);
        throw error;
      }
    }),
  };
  return { prisma: client };
});

vi.mock('@/modules/Workpack/Services/WorkpackService', () => ({
  WorkpackService: {
    createWorkpack: vi.fn(async (data: any) => {
      const created = {
        id: WP_EQUIP,
        organization_id: data.organization_id,
        site_id: data.site_id,
        event_id: data.event_id ?? EVENT_2027,
        discipline_id: data.discipline_id ?? DISC_MECH,
        asset_id: data.asset_id ?? ASSET_HX,
        unit_id: data.unit_id ?? UNIT_A,
        plant_id: PLANT_A,
        system_id: SYSTEM_A,
        contractor_id: data.contractor_id ?? null,
        equipment_type: data.equipment_type ?? 'HEX-ST',
        workpack_number: 'WP-2027-00001',
        deleted_at: null,
        asset: store.assets[0],
      };
      const idx = store.workpacks.findIndex((w) => w.id === created.id);
      if (idx >= 0) store.workpacks[idx] = { ...store.workpacks[idx], ...created };
      else store.workpacks.push(created);
      return created;
    }),
  },
}));

vi.mock('@/lib/queues', () => ({
  scheduleRecalculateQueue: { add: vi.fn(async () => ({})) },
}));

const ctx = {
  organizationId: ORG_A,
  userId: USER_A,
  sourceChannel: 'test' as const,
  eventId: EVENT_2027,
};

describe('R0.1 Activity identity creation', () => {
  beforeEach(() => {
    seedFixtures();
    vi.clearAllMocks();
  });

  it('R01-01 creates an activity with workpack and derived event identity', async () => {
    const created = await createActivity(ctx, {
      workpackId: WP_EQUIP,
      description: 'Pull bundle HX-204',
    });

    expect(created.organization_id).toBe(ORG_A);
    expect(created.workpack_id).toBe(WP_EQUIP);
    expect(created.event_id).toBe(EVENT_2027);
    expect(created.discipline_id).toBe(DISC_MECH);
    expect(created.status).toBe('not_started');
    expect(created.progress_percent).toBe(0);
    expect(store.activities).toHaveLength(1);
  });

  it('R01-02 template instantiate writes identity onto generated activities', async () => {
    vi.spyOn(TemplateLibraryService, 'get').mockResolvedValue({
      id: TPL_ID,
      organization_id: ORG_A,
      lifecycle_status: 'PUBLISHED',
      name: 'HX Bundle Pullout',
      equipment_type: 'HEX-ST',
      discipline_id: DISC_MECH,
      description: 'Bundle pull template',
      job_type: 'Mechanical',
      revision: 1,
      template_family_id: TPL_ID,
      knowledge_asset_id: null,
      planning_json: {},
      resources_json: [],
      materials_json: [],
      safety_json: {},
      qaqc_json: {},
      references_json: [],
      ai_metadata_json: {},
      activities: [
        {
          sequence_number: 1,
          activity_code: 'BPULL',
          description: 'Bundle pullout',
          duration_hours: 16,
        },
      ],
      logic_links: [],
    } as any);

    await TemplateLibraryService.instantiate({
      templateId: TPL_ID,
      organizationId: ORG_A,
      siteId: SITE_A,
      userId: USER_A,
      event_id: EVENT_2027,
      asset_id: ASSET_HX,
      discipline_id: DISC_MECH,
    });

    expect(store.activities).toHaveLength(1);
    expect(store.activities[0].event_id).toBe(EVENT_2027);
    expect(store.activities[0].workpack_id).toBe(WP_EQUIP);
    expect(store.activities[0].organization_id).toBe(ORG_A);
    expect(store.activities[0].discipline_id).toBe(DISC_MECH);
  });

  it('R01-03 populates standard_activity_type_id from a valid template SAT code', async () => {
    vi.spyOn(TemplateLibraryService, 'get').mockResolvedValue({
      id: TPL_ID,
      organization_id: ORG_A,
      lifecycle_status: 'PUBLISHED',
      name: 'HX Bundle Pullout',
      equipment_type: 'HEX-ST',
      discipline_id: DISC_MECH,
      description: 'Bundle pull template',
      job_type: 'Mechanical',
      revision: 1,
      template_family_id: TPL_ID,
      knowledge_asset_id: null,
      planning_json: {},
      resources_json: [],
      materials_json: [],
      safety_json: {},
      qaqc_json: {},
      references_json: [],
      ai_metadata_json: {},
      activities: [
        {
          sequence_number: 1,
          activity_code: 'BPULL',
          description: 'Bundle pullout',
          duration_hours: 16,
        },
      ],
      logic_links: [],
    } as any);

    await TemplateLibraryService.instantiate({
      templateId: TPL_ID,
      organizationId: ORG_A,
      siteId: SITE_A,
      userId: USER_A,
      event_id: EVENT_2027,
      asset_id: ASSET_HX,
      discipline_id: DISC_MECH,
    });

    expect(store.activities[0].standard_activity_type_id).toBe(SAT_BPULL);
  });

  it('R01-04 rejects an explicit invalid standard activity', async () => {
    await expect(
      createActivity(ctx, {
        workpackId: WP_EQUIP,
        description: 'Unknown SAT',
        standardActivityType: 'NOT_A_REAL_SAT',
      })
    ).rejects.toBeInstanceOf(ControlledValidationError);
    expect(store.activities).toHaveLength(0);
  });

  it('R01-05 rejects a workpack from another tenant', async () => {
    await expect(
      createActivity(ctx, {
        workpackId: WP_B,
        description: 'Cross tenant',
      })
    ).rejects.toMatchObject({ identityCode: 'CROSS_TENANT_WORKPACK' });
    expect(store.activities).toHaveLength(0);
  });

  it('R01-06 rejects a caller event from another tenant', async () => {
    store.events.push({
      id: 'e-tenant-b',
      organization_id: ORG_B,
      site_id: SITE_A,
      deleted_at: null,
    });

    await expect(
      createActivity(
        { ...ctx, eventId: 'e-tenant-b' },
        { allowLoose: true, description: 'Event from B', siteId: SITE_A }
      )
    ).rejects.toMatchObject({ identityCode: 'CROSS_TENANT_EVENT' });
    expect(store.activities).toHaveLength(0);
  });

  it('R01-07 rejects workpack event TA-2027 with caller event TA-2028', async () => {
    await expect(
      createActivity(
        { ...ctx, eventId: EVENT_2028 },
        { workpackId: WP_EQUIP, description: 'Mismatched event' }
      )
    ).rejects.toMatchObject({ identityCode: 'EVENT_MISMATCH' });
    expect(store.activities).toHaveLength(0);
  });

  it('R01-08 rejects an invalid hierarchy', async () => {
    store.units[0].plant_id = 'other-plant';
    await expect(
      createActivity(ctx, {
        workpackId: WP_EQUIP,
        description: 'Broken hierarchy',
      })
    ).rejects.toMatchObject({ identityCode: 'INVALID_HIERARCHY' });
    expect(store.activities).toHaveLength(0);
  });

  it('R01-09 keeps equipment context on the workpack and does not invent Activity.asset_id', async () => {
    const created = await createActivity(ctx, {
      workpackId: WP_EQUIP,
      description: 'Equipment-specific',
      assetId: ASSET_HX,
    });
    expect(created.workpack_id).toBe(WP_EQUIP);
    expect(created).not.toHaveProperty('asset_id');
    expect((created as any).asset_id).toBeUndefined();
    expect(store.workpacks.find((w) => w.id === WP_EQUIP)?.asset_id).toBe(ASSET_HX);
  });

  it('R01-10 allows a system-level activity without an equipment FK', async () => {
    const created = await createActivity(ctx, {
      workpackId: WP_SYSTEM,
      description: 'Unit isolation',
    });
    expect(created.workpack_id).toBe(WP_SYSTEM);
    expect(created.event_id).toBe(EVENT_2027);
    expect(created.standard_activity_type_id).toBeNull();
    expect((created as any).asset_id).toBeUndefined();
  });

  it('R01-11 rejects an explicit SAT when equipment type cannot be established', async () => {
    await expect(
      createActivity(ctx, {
        workpackId: WP_SYSTEM,
        description: 'Ambiguous SAT',
        standardActivityType: 'BPULL',
      })
    ).rejects.toMatchObject({ identityCode: 'INVALID_STANDARD_ACTIVITY' });
    expect(store.activities).toHaveLength(0);
  });

  it('R01-12 leaves no activity after validation failure', async () => {
    await expect(
      createActivity(ctx, {
        workpackId: 'missing-workpack',
        description: 'Will fail',
      })
    ).rejects.toBeInstanceOf(ActivityIdentityError);
    expect(store.activities).toHaveLength(0);
  });

  it('R01-13 writes audit provenance with source channel', async () => {
    await createActivity(ctx, {
      workpackId: WP_EQUIP,
      description: 'Audited create',
      templateId: TPL_ID,
    });
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0].auditable_type).toBe('Activity');
    expect(store.audits[0].new_values.source_channel).toBe('test');
    expect(store.audits[0].new_values.template_id).toBe(TPL_ID);
  });

  it('R01-14 Tenant A cannot create against Tenant B workpack', async () => {
    await expect(
      createActivity(ctx, {
        workpackId: WP_B,
        description: 'Stolen workpack',
      })
    ).rejects.toMatchObject({ identityCode: 'CROSS_TENANT_WORKPACK' });
  });

  it('R01-15 ActivityService adapter applies the same identity rules', async () => {
    await expect(
      ActivityService.createActivity({
        organization_id: ORG_A,
        created_by: USER_A,
        workpack_id: WP_EQUIP,
        event_id: EVENT_2028,
        description: 'Adapter mismatch',
        source_channel: 'api',
      })
    ).rejects.toMatchObject({ identityCode: 'EVENT_MISMATCH' });

    const created = await ActivityService.createActivity({
      organization_id: ORG_A,
      created_by: USER_A,
      workpack_id: WP_EQUIP,
      event_id: EVENT_2027,
      description: 'Adapter success',
      source_channel: 'api',
    });
    expect(created.event_id).toBe(EVENT_2027);
    expect(created.workpack_id).toBe(WP_EQUIP);
  });
});
