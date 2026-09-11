/**
 * R0.3 behavioural tests — Scope Change tenant / event / activity ownership.
 * These execute proposal and apply services. They do not grep source for field names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ScopeChangeProposalService } from '../ScopeChangeProposalService';
import { ScopeChangeApplicationService } from '../ScopeChangeApplicationService';
import {
  EVENT_CONTEXT_MISMATCH,
  GENERIC_ACTIVITY_NOT_FOUND,
  GENERIC_SCOPE_CHANGE_NOT_FOUND,
  GENERIC_WORKPACK_NOT_FOUND,
  LOOSE_ACTIVITY_NO_CONTEXT,
  REMOVE_ACTIVITY_M12,
  WORKPACK_EVENT_MISMATCH,
  ACTIVITY_EVENT_WORKPACK_MISMATCH,
} from '../ScopeChangeOwnership';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SITE_A = 's1111111-1111-4111-8111-111111111111';
const SITE_B = 's2222222-2222-4222-8222-222222222222';
const EVENT_A_2027 = 'e2027000-0000-4000-8000-000000002027';
const EVENT_A_2029 = 'e2029000-0000-4000-8000-000000002029';
const EVENT_B = 'ebbbbb00-0000-4000-8000-00000000000b';
const WP_A = 'waaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WP_A_2029 = 'wa202900-0000-4000-8000-000000002029';
const WP_B = 'wbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACT_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const ACT_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const ACT_A_2029 = 'aa202900-0000-4000-8000-000000002029';
const ACT_LOOSE_EVENT = 'aa1eeee0-0000-4000-8000-000000000001';
const ACT_LOOSE_NONE = 'aa100000-0000-4000-8000-000000000000';
const ACT_NULL_EVENT_WP = 'aa1null0-0000-4000-8000-000000000001';
const ACT_MISMATCHED = 'aa1miss0-0000-4000-8000-000000000001';
const SC_A = 'scaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SC_A_APPROVED = 'scaapp00-0000-4000-8000-000000000001';
const SC_B = 'scbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MISSING = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

type Row = Record<string, any>;

const store: {
  activities: Row[];
  workpacks: Row[];
  events: Row[];
  scopeChanges: Row[];
  items: Row[];
  audits: Row[];
} = {
  activities: [],
  workpacks: [],
  events: [],
  scopeChanges: [],
  items: [],
  audits: [],
};

function activityRow(partial: Row): Row {
  return {
    status: 'not_started',
    progress_percent: 0,
    actual_start: null,
    actual_end: null,
    deleted_at: null,
    duration_hours: 8,
    budgeted_cost: 100,
    planned_start: null,
    planned_end: null,
    description: 'Activity',
    ...partial,
  };
}

function seedFixtures() {
  store.activities = [
    activityRow({
      id: ACT_A,
      organization_id: ORG_A,
      event_id: EVENT_A_2027,
      workpack_id: WP_A,
      description: 'Tenant A 2027',
      status: 'in_progress',
      progress_percent: 40,
      actual_start: new Date('2027-01-01'),
    }),
    activityRow({
      id: ACT_B,
      organization_id: ORG_B,
      event_id: EVENT_B,
      workpack_id: WP_B,
      description: 'Tenant B secret',
      status: 'in_progress',
      progress_percent: 55,
    }),
    activityRow({
      id: ACT_A_2029,
      organization_id: ORG_A,
      event_id: EVENT_A_2029,
      workpack_id: WP_A_2029,
      description: 'Tenant A 2029',
    }),
    activityRow({
      id: ACT_LOOSE_EVENT,
      organization_id: ORG_A,
      event_id: EVENT_A_2027,
      workpack_id: null,
      description: 'Loose with event',
    }),
    activityRow({
      id: ACT_LOOSE_NONE,
      organization_id: ORG_A,
      event_id: null,
      workpack_id: null,
      description: 'Loose no context',
    }),
    activityRow({
      id: ACT_NULL_EVENT_WP,
      organization_id: ORG_A,
      event_id: null,
      workpack_id: WP_A,
      description: 'Null event with workpack',
    }),
    activityRow({
      id: ACT_MISMATCHED,
      organization_id: ORG_A,
      event_id: EVENT_A_2027,
      workpack_id: WP_A_2029,
      description: 'Event/workpack mismatch',
    }),
  ];
  store.workpacks = [
    {
      id: WP_A,
      organization_id: ORG_A,
      site_id: SITE_A,
      event_id: EVENT_A_2027,
      deleted_at: null,
      title: 'WP A 2027',
      workpack_number: 'WP-A-2027',
      discipline_id: null,
      plant_id: null,
      unit_id: null,
      system_id: null,
      contractor_id: null,
      equipment_type: null,
      asset_id: null,
      asset: null,
    },
    {
      id: WP_A_2029,
      organization_id: ORG_A,
      site_id: SITE_A,
      event_id: EVENT_A_2029,
      deleted_at: null,
      title: 'WP A 2029',
      workpack_number: 'WP-A-2029',
      discipline_id: null,
      plant_id: null,
      unit_id: null,
      system_id: null,
      contractor_id: null,
      equipment_type: null,
      asset_id: null,
      asset: null,
    },
    {
      id: WP_B,
      organization_id: ORG_B,
      site_id: SITE_B,
      event_id: EVENT_B,
      deleted_at: null,
      title: 'WP B',
      workpack_number: 'WP-B',
      discipline_id: null,
      plant_id: null,
      unit_id: null,
      system_id: null,
      contractor_id: null,
      equipment_type: null,
      asset_id: null,
      asset: null,
    },
  ];
  store.events = [
    { id: EVENT_A_2027, organization_id: ORG_A, site_id: SITE_A, deleted_at: null, planned_start: null, planned_end: null },
    { id: EVENT_A_2029, organization_id: ORG_A, site_id: SITE_A, deleted_at: null, planned_start: null, planned_end: null },
    { id: EVENT_B, organization_id: ORG_B, site_id: SITE_B, deleted_at: null, planned_start: null, planned_end: null },
  ];
  store.scopeChanges = [
    {
      id: SC_A,
      organization_id: ORG_A,
      event_id: EVENT_A_2027,
      status: 'draft',
      change_number: 'SCH-001',
      title: 'SC A',
      discovery_id: null,
    },
    {
      id: SC_A_APPROVED,
      organization_id: ORG_A,
      event_id: EVENT_A_2027,
      status: 'approved',
      change_number: 'SCH-002',
      title: 'SC A approved',
      discovery_id: null,
    },
    {
      id: SC_B,
      organization_id: ORG_B,
      event_id: EVENT_B,
      status: 'draft',
      change_number: 'SCH-B01',
      title: 'SC B',
      discovery_id: null,
    },
  ];
  store.items = [];
  store.audits = [];
}

function matchRow(rows: Row[], where: any) {
  if (!where) return rows[0] ?? null;
  return (
    rows.find((row) => {
      if (where.id && row.id !== where.id) return false;
      if (where.organization_id && row.organization_id !== where.organization_id) return false;
      if (where.event_id && row.event_id !== where.event_id) return false;
      if (where.scope_change_id && row.scope_change_id !== where.scope_change_id) return false;
      if (where.deleted_at === null && row.deleted_at) return false;
      return true;
    }) ?? null
  );
}

function withItems(sc: Row | null) {
  if (!sc) return null;
  return {
    ...sc,
    items: store.items
      .filter((i) => i.scope_change_id === sc.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  };
}

vi.mock('@/lib/prisma', () => {
  const client: any = {
    scheduleScopeChange: {
      findFirst: vi.fn(async ({ where }: any) => withItems(matchRow(store.scopeChanges, where))),
      findMany: vi.fn(async ({ where }: any) =>
        store.scopeChanges.filter((sc) => {
          if (where?.organization_id && sc.organization_id !== where.organization_id) return false;
          if (where?.event_id && sc.event_id !== where.event_id) return false;
          return true;
        })
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const sc = store.scopeChanges.find((row) => row.id === where.id);
        if (sc) Object.assign(sc, data);
        return withItems(sc ?? null);
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, items: [] };
        store.scopeChanges.push(row);
        return row;
      }),
    },
    scheduleScopeChangeItem: {
      findFirst: vi.fn(async ({ where }: any) => {
        const item = matchRow(store.items, where);
        if (!item) return null;
        return {
          ...item,
          scopeChange: store.scopeChanges.find((sc) => sc.id === item.scope_change_id) ?? null,
        };
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `item-${store.items.length + 1}`, ...data };
        store.items.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = store.items.find((row) => row.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = store.items.findIndex((row) => row.id === where.id);
        if (idx >= 0) return store.items.splice(idx, 1)[0];
        return null;
      }),
      aggregate: vi.fn(async ({ where }: any) => {
        const scoped = store.items.filter((i) => i.scope_change_id === where.scope_change_id);
        const max = scoped.reduce((m, i) => Math.max(m, i.sort_order ?? 0), 0);
        return { _max: { sort_order: max || null } };
      }),
    },
    activity: {
      findFirst: vi.fn(async ({ where }: any) => matchRow(store.activities, where)),
      create: vi.fn(async ({ data }: any) => {
        const row = activityRow(data);
        store.activities.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const act = store.activities.find((row) => row.id === where.id);
        if (act) Object.assign(act, data);
        return act;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const act of store.activities) {
          if (where.id && act.id !== where.id) continue;
          if (where.organization_id && act.organization_id !== where.organization_id) continue;
          if (where.deleted_at === null && act.deleted_at) continue;
          Object.assign(act, data);
          count++;
        }
        return { count };
      }),
      aggregate: vi.fn(async ({ where }: any) => {
        const scoped = store.activities.filter((a) => {
          if (where.workpack_id && a.workpack_id !== where.workpack_id) return false;
          if (where.event_id && a.event_id !== where.event_id) return false;
          if (where.organization_id && a.organization_id !== where.organization_id) return false;
          return !a.deleted_at;
        });
        const max = scoped.reduce((m, a) => Math.max(m, a.sequence_number ?? 0), 0);
        return { _max: { sequence_number: max || null } };
      }),
    },
    workpack: {
      findFirst: vi.fn(async ({ where }: any) => matchRow(store.workpacks, where)),
      create: vi.fn(async ({ data }: any) => {
        const row = {
          deleted_at: null,
          discipline_id: null,
          plant_id: null,
          unit_id: null,
          system_id: null,
          contractor_id: null,
          equipment_type: null,
          asset_id: null,
          asset: null,
          ...data,
        };
        store.workpacks.push(row);
        return row;
      }),
    },
    event: {
      findFirst: vi.fn(async ({ where }: any) => matchRow(store.events, where)),
    },
    site: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === SITE_A || where.id === SITE_B ? { id: where.id, organization_id: where.organization_id } : null
      ),
    },
    discipline: { findFirst: vi.fn(async () => null) },
    equipmentType: { findFirst: vi.fn(async () => null) },
    standardActivityType: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    asset: { findFirst: vi.fn(async () => null) },
    contractor: { findFirst: vi.fn(async () => null) },
    unit: { findFirst: vi.fn(async () => null) },
    system: { findFirst: vi.fn(async () => null) },
    scopeItem: {
      findFirst: vi.fn(async () => null),
    },
    activity_code_default_resources: {
      findMany: vi.fn(async () => []),
    },
    activityResource: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    discoveryWork: {
      update: vi.fn(async ({ data }: any) => data),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        if (data?.force_fail) throw new Error('audit write failed');
        store.audits.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (fn: any) => {
      const snap = JSON.parse(
        JSON.stringify({
          activities: store.activities,
          workpacks: store.workpacks,
          scopeChanges: store.scopeChanges,
          items: store.items,
          audits: store.audits,
        })
      );
      try {
        return await fn(client);
      } catch (error) {
        store.activities.splice(0, store.activities.length, ...snap.activities);
        store.workpacks.splice(0, store.workpacks.length, ...snap.workpacks);
        store.scopeChanges.splice(0, store.scopeChanges.length, ...snap.scopeChanges);
        store.items.splice(0, store.items.length, ...snap.items);
        store.audits.splice(0, store.audits.length, ...snap.audits);
        throw error;
      }
    }),
  };
  return { prisma: client };
});

function cloneRow(row: Row | undefined) {
  return JSON.parse(JSON.stringify(row ?? null));
}

function snapshotB() {
  return cloneRow(store.activities.find((a) => a.id === ACT_B));
}

function expectUnchanged(id: string, before: Row) {
  expect(cloneRow(store.activities.find((a) => a.id === id))).toEqual(before);
}

function itemsFor(scId: string) {
  return store.items.filter((i) => i.scope_change_id === scId);
}

describe('R0.3 Scope Change identity security', () => {
  beforeEach(() => {
    seedFixtures();
    vi.clearAllMocks();
  });

  it('R03-01 authorized same-tenant same-event add + apply modify succeeds and writes audit', async () => {
    const item = await ScopeChangeProposalService.addItem(
      SC_A,
      ORG_A,
      {
        item_type: 'modify_activity',
        description: 'Extend duration',
        activity_id: ACT_A,
        estimated_hours: 16,
        estimated_cost: 250,
      },
      { eventId: EVENT_A_2027, userId: USER_A }
    );
    expect(item.activity_id).toBe(ACT_A);

    const approved = store.scopeChanges.find((s) => s.id === SC_A)!;
    approved.status = 'approved';
    store.items[0].scope_change_id = SC_A;

    const applied = await ScopeChangeApplicationService.apply(SC_A, ORG_A, USER_A, EVENT_A_2027);
    expect(applied.activities_modified).toEqual([ACT_A]);

    const act = store.activities.find((a) => a.id === ACT_A)!;
    expect(act.duration_hours).toBe(16);
    expect(act.budgeted_cost).toBe(250);
    expect(act.description).toBe('Extend duration');
    expect(act.status).toBe('in_progress');
    expect(act.progress_percent).toBe(40);
    expect(act.actual_start).toEqual(new Date('2027-01-01'));
    expect(act.organization_id).toBe(ORG_A);
    expect(act.event_id).toBe(EVENT_A_2027);
    expect(approved.status).toBe('applied');
    expect(store.audits.some((a) => a.event === 'SCOPE_CHANGE_APPLIED')).toBe(true);
  });

  it('R03-02 Tenant A cannot add Tenant B Activity; B unchanged; A items not poisoned', async () => {
    const beforeB = snapshotB();
    const beforeItems = itemsFor(SC_A).length;

    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        {
          item_type: 'modify_activity',
          description: 'cross tenant',
          activity_id: ACT_B,
        },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND, statusCode: 404 });

    expectUnchanged(ACT_B, beforeB);
    expect(itemsFor(SC_A)).toHaveLength(beforeItems);
    expect(store.scopeChanges.find((s) => s.id === SC_A)!.status).toBe('draft');
    const rejection = store.audits.find((a) => a.new_values?.result === 'rejected');
    expect(rejection?.organization_id).toBe(ORG_A);
    expect(store.audits.filter((a) => a.organization_id === ORG_B)).toHaveLength(0);
  });

  it('R03-03 Tenant A cannot apply a poisoned modify of Tenant B Activity', async () => {
    const beforeB = snapshotB();
    store.items.push({
      id: 'poison-1',
      scope_change_id: SC_A_APPROVED,
      item_type: 'modify_activity',
      description: 'hack',
      activity_id: ACT_B,
      workpack_id: null,
      predecessor_ids: [],
      estimated_hours: 99,
      estimated_cost: 1,
      planned_start: null,
      planned_end: null,
      discipline: null,
      sort_order: 1,
    });

    await expect(
      ScopeChangeApplicationService.apply(SC_A_APPROVED, ORG_A, USER_A, EVENT_A_2027)
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND });

    expectUnchanged(ACT_B, beforeB);
    expect(store.scopeChanges.find((s) => s.id === SC_A_APPROVED)!.status).toBe('approved');
    expect(store.audits.some((a) => a.event === 'SCOPE_CHANGE_APPLIED')).toBe(false);
  });

  it('R03-04 cross-event Activity on same tenant is rejected and unchanged', async () => {
    const before = cloneRow(store.activities.find((a) => a.id === ACT_A_2029));

    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        {
          item_type: 'modify_activity',
          description: 'wrong event',
          activity_id: ACT_A_2029,
        },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: EVENT_CONTEXT_MISMATCH, statusCode: 400 });

    expectUnchanged(ACT_A_2029, before);
    expect(itemsFor(SC_A)).toHaveLength(0);
  });

  it('R03-05 wrong tenant and nonexistent UUID return the same generic activity message', async () => {
    let foreignMsg = '';
    let missingMsg = '';
    try {
      await ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'remove_activity', description: 'x', activity_id: ACT_B },
        { userId: USER_A, eventId: EVENT_A_2027 }
      );
    } catch (err: any) {
      foreignMsg = err.message;
    }
    try {
      await ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'remove_activity', description: 'x', activity_id: MISSING },
        { userId: USER_A, eventId: EVENT_A_2027 }
      );
    } catch (err: any) {
      missingMsg = err.message;
    }
    expect(foreignMsg).toBe(GENERIC_ACTIVITY_NOT_FOUND);
    expect(missingMsg).toBe(GENERIC_ACTIVITY_NOT_FOUND);
    expect(foreignMsg).toBe(missingMsg);
    expect(foreignMsg.toLowerCase()).not.toContain('tenant');
    expect(foreignMsg.toLowerCase()).not.toContain(ORG_B);
  });

  it('R03-06 missing Activity is rejected', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'modify_activity', description: 'missing', activity_id: MISSING },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND });
  });

  it('R03-07 cross-tenant Workpack is rejected with generic workpack message', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        {
          item_type: 'new_activity',
          description: 'use B workpack',
          workpack_id: WP_B,
        },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_WORKPACK_NOT_FOUND, statusCode: 404 });
    expect(itemsFor(SC_A)).toHaveLength(0);
  });

  it('R03-08 cross-event Workpack is rejected', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        {
          item_type: 'new_activity',
          description: 'use 2029 workpack',
          workpack_id: WP_A_2029,
        },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: WORKPACK_EVENT_MISMATCH, statusCode: 400 });
  });

  it('R03-09 missing Workpack UUID is rejected safely', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'new_activity', description: 'missing wp', workpack_id: MISSING },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_WORKPACK_NOT_FOUND });
  });

  it('R03-10 loose Activity with event and no workpack may participate', async () => {
    const item = await ScopeChangeProposalService.addItem(
      SC_A,
      ORG_A,
      {
        item_type: 'modify_activity',
        description: 'loose ok',
        activity_id: ACT_LOOSE_EVENT,
        estimated_hours: 12,
      },
      { eventId: EVENT_A_2027, userId: USER_A }
    );
    expect(item.activity_id).toBe(ACT_LOOSE_EVENT);
  });

  it('R03-11 loose Activity with no event and no workpack is rejected', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'modify_activity', description: 'no context', activity_id: ACT_LOOSE_NONE },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: LOOSE_ACTIVITY_NO_CONTEXT, statusCode: 400 });
  });

  it('R03-12 Activity with null event_id but matching workpack event is allowed', async () => {
    const item = await ScopeChangeProposalService.addItem(
      SC_A,
      ORG_A,
      {
        item_type: 'modify_activity',
        description: 'r0.2 leftover',
        activity_id: ACT_NULL_EVENT_WP,
      },
      { eventId: EVENT_A_2027, userId: USER_A }
    );
    expect(item.activity_id).toBe(ACT_NULL_EVENT_WP);
  });

  it('R03-13 Activity whose event disagrees with its workpack event is rejected', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'modify_activity', description: 'mismatch', activity_id: ACT_MISMATCHED },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: ACTIVITY_EVENT_WORKPACK_MISMATCH, statusCode: 400 });
  });

  it('R03-14 unauthorized org cannot operate on another tenant Scope Change', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_B,
        { item_type: 'modify_activity', description: 'nope', activity_id: ACT_A },
        { eventId: EVENT_A_2027, userId: USER_B }
      )
    ).rejects.toThrow(GENERIC_SCOPE_CHANGE_NOT_FOUND);
    expect(itemsFor(SC_A)).toHaveLength(0);
  });

  it('R03-15 wrong event URL context cannot attach to a Scope Change', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'modify_activity', description: 'wrong url', activity_id: ACT_A },
        { eventId: EVENT_A_2029, userId: USER_A }
      )
    ).rejects.toThrow(GENERIC_SCOPE_CHANGE_NOT_FOUND);
    expect(itemsFor(SC_A)).toHaveLength(0);
  });

  it('R03-16 Tenant B Event cannot be used to create a Tenant A Scope Change', async () => {
    await expect(
      ScopeChangeProposalService.create({
        organization_id: ORG_A,
        event_id: EVENT_B,
        title: 'cross event create',
        created_by: USER_A,
      })
    ).rejects.toThrow('Event not found');
  });

  it('R03-17 predecessor from another tenant is rejected', async () => {
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        {
          item_type: 'new_activity',
          description: 'pred',
          workpack_id: WP_A,
          predecessor_ids: [ACT_B],
        },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND });
  });

  it('R03-18 remove_activity apply is refused and does not write execution status', async () => {
    store.items.push({
      id: 'rm-1',
      scope_change_id: SC_A_APPROVED,
      item_type: 'remove_activity',
      description: 'cancel',
      activity_id: ACT_A,
      workpack_id: null,
      predecessor_ids: [],
      estimated_hours: 0,
      estimated_cost: 0,
      planned_start: null,
      planned_end: null,
      discipline: null,
      sort_order: 1,
    });
    const before = cloneRow(store.activities.find((a) => a.id === ACT_A));

    await expect(
      ScopeChangeApplicationService.apply(SC_A_APPROVED, ORG_A, USER_A, EVENT_A_2027)
    ).rejects.toMatchObject({ message: REMOVE_ACTIVITY_M12, statusCode: 422 });

    expectUnchanged(ACT_A, before);
    expect(store.activities.find((a) => a.id === ACT_A)!.status).not.toBe('cancelled');
    expect(store.scopeChanges.find((s) => s.id === SC_A_APPROVED)!.status).toBe('approved');
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it('R03-19 authorized new_activity apply uses ActivityCreationCommand identity', async () => {
    store.items.push({
      id: 'new-1',
      scope_change_id: SC_A_APPROVED,
      item_type: 'new_activity',
      description: 'New governed activity',
      activity_id: null,
      workpack_id: WP_A,
      predecessor_ids: [],
      estimated_hours: 6,
      estimated_cost: 10,
      planned_start: null,
      planned_end: null,
      discipline: null,
      sort_order: 1,
    });

    const beforeCount = store.activities.length;
    const applied = await ScopeChangeApplicationService.apply(SC_A_APPROVED, ORG_A, USER_A, EVENT_A_2027);
    expect(applied.activities_created).toHaveLength(1);

    const created = store.activities.find((a) => a.id === applied.activities_created[0])!;
    expect(store.activities.length).toBe(beforeCount + 1);
    expect(created.organization_id).toBe(ORG_A);
    expect(created.event_id).toBe(EVENT_A_2027);
    expect(created.workpack_id).toBe(WP_A);
    expect(created.status).toBe('not_started');
    expect(created.progress_percent).toBe(0);
    expect(created.description).toBe('New governed activity');
  });

  it('R03-20 duplicate add of the same Activity is allowed by current proposal design', async () => {
    await ScopeChangeProposalService.addItem(
      SC_A,
      ORG_A,
      { item_type: 'modify_activity', description: 'one', activity_id: ACT_A },
      { eventId: EVENT_A_2027, userId: USER_A }
    );
    await ScopeChangeProposalService.addItem(
      SC_A,
      ORG_A,
      { item_type: 'modify_activity', description: 'two', activity_id: ACT_A },
      { eventId: EVENT_A_2027, userId: USER_A }
    );
    expect(itemsFor(SC_A)).toHaveLength(2);
  });

  it('R03-21 transaction failure rolls back Activity and Scope Change', async () => {
    store.items.push({
      id: 'tx-1',
      scope_change_id: SC_A_APPROVED,
      item_type: 'modify_activity',
      description: 'will rollback',
      activity_id: ACT_A,
      workpack_id: null,
      predecessor_ids: [],
      estimated_hours: 99,
      estimated_cost: 99,
      planned_start: null,
      planned_end: null,
      discipline: null,
      sort_order: 1,
    });
    const before = cloneRow(store.activities.find((a) => a.id === ACT_A));
    const auditCreate = prisma.auditLog.create as unknown as ReturnType<typeof vi.fn>;
    auditCreate.mockImplementationOnce(async () => {
      throw new Error('audit write failed');
    });

    await expect(
      ScopeChangeApplicationService.apply(SC_A_APPROVED, ORG_A, USER_A, EVENT_A_2027)
    ).rejects.toThrow('audit write failed');

    expectUnchanged(ACT_A, before);
    expect(store.scopeChanges.find((s) => s.id === SC_A_APPROVED)!.status).toBe('approved');
  });

  it('R03-22 updateItem cannot retarget to Tenant B Activity', async () => {
    const item = await ScopeChangeProposalService.addItem(
      SC_A,
      ORG_A,
      { item_type: 'modify_activity', description: 'ok', activity_id: ACT_A },
      { eventId: EVENT_A_2027, userId: USER_A }
    );
    const beforeB = snapshotB();

    await expect(
      ScopeChangeProposalService.updateItem(
        item.id,
        ORG_A,
        { activity_id: ACT_B },
        { eventId: EVENT_A_2027, userId: USER_A, scopeChangeId: SC_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND });

    const stored = store.items.find((i) => i.id === item.id)!;
    expect(stored.activity_id).toBe(ACT_A);
    expectUnchanged(ACT_B, beforeB);
  });

  it('R03-23 Tenant A cannot attach Tenant B Activity as a remove item', async () => {
    const beforeB = snapshotB();
    await expect(
      ScopeChangeProposalService.addItem(
        SC_A,
        ORG_A,
        { item_type: 'remove_activity', description: 'remove B', activity_id: ACT_B },
        { eventId: EVENT_A_2027, userId: USER_A }
      )
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND });
    expectUnchanged(ACT_B, beforeB);
    expect(itemsFor(SC_A)).toHaveLength(0);
  });

  it('R03-24 submit re-validates items and refuses a poisoned Activity reference', async () => {
    store.items.push({
      id: 'sub-1',
      scope_change_id: SC_A,
      item_type: 'modify_activity',
      description: 'poisoned',
      activity_id: ACT_B,
      workpack_id: null,
      predecessor_ids: [],
      estimated_hours: 1,
      estimated_cost: 1,
      planned_start: null,
      planned_end: null,
      discipline: null,
      sort_order: 1,
    });

    await expect(
      ScopeChangeProposalService.submit(SC_A, ORG_A, USER_A, EVENT_A_2027)
    ).rejects.toMatchObject({ message: GENERIC_ACTIVITY_NOT_FOUND });
    expect(store.scopeChanges.find((s) => s.id === SC_A)!.status).toBe('draft');
  });
});
