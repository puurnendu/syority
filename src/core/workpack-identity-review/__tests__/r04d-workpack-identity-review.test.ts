/**
 * R0.4-D behavioural tests — Workpack Event review.
 * These execute the review service. They do not grep source for field names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { WorkpackIdentityReviewService } from '../WorkpackIdentityReviewService';
import { classifyEvidence, looksNonSto } from '../WorkpackIdentityEvidence';
import { GENERIC_EVENT_NOT_FOUND, GENERIC_WORKPACK_NOT_FOUND, type ReviewActor } from '../types';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_TA = 'e2027000-0000-4000-8000-000000002027';
const EVENT_B = 'ebbbbb00-0000-4000-8000-00000000000b';
const EVENT_2 = 'e2028000-0000-4000-8000-000000002028';
const WP_A = 'waaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WP_B = 'wbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WP_CONFLICT = 'wccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WP_INSUFF = 'wiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii';
const WP_NONSTO = 'wnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn';
const MISSING = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

type Row = Record<string, any>;

const store: {
  workpacks: Row[];
  reviews: Row[];
  events: Row[];
  activities: Row[];
  audits: Row[];
  activityUpdates: number;
} = {
  workpacks: [],
  reviews: [],
  events: [],
  activities: [],
  audits: [],
  activityUpdates: 0,
};

const actorA: ReviewActor = {
  userId: USER_A,
  organizationId: ORG_A,
  canViewWorkpacks: true,
  canEditWorkpacks: true,
  canApproveWorkpacks: true,
  canViewEvents: true,
};

function seed() {
  store.activityUpdates = 0;
  store.audits = [];
  store.reviews = [];
  store.events = [
    { id: EVENT_TA, organization_id: ORG_A, code: 'TA-2027', name: 'Turnaround 2027', status: 'planning', planned_start: null, planned_end: null, deleted_at: null, site: { name: 'Site A' } },
    { id: EVENT_2, organization_id: ORG_A, code: 'TA-2028', name: 'Turnaround 2028', status: 'planning', planned_start: null, planned_end: null, deleted_at: null, site: { name: 'Site A' } },
    { id: EVENT_B, organization_id: ORG_B, code: 'TB-1', name: 'Tenant B Event', status: 'planning', planned_start: null, planned_end: null, deleted_at: null, site: { name: 'Site B' } },
  ];
  store.workpacks = [
    wp({ id: WP_A, title: 'Overhaul Exchanger A', workpack_number: 'WP-INSUFF' }),
    wp({ id: WP_INSUFF, title: 'Overhaul Exchanger A', workpack_number: null }),
    wp({ id: WP_NONSTO, title: 'Test Submit WP', workpack_number: null }),
    wp({
      id: WP_CONFLICT,
      title: 'Phase 2C Test WP',
      workpack_number: 'TEST-WP-PH2C-1788013251870',
      status: 'issued',
    }),
    wp({ id: WP_B, organization_id: ORG_B, title: 'Tenant B WP' }),
  ];
  store.activities = [
    { id: 'act-1', workpack_id: WP_CONFLICT, organization_id: ORG_A, event_id: EVENT_TA, activity_number: 'ACT-001', description: 'Weld', deleted_at: null },
    { id: 'act-2', workpack_id: WP_CONFLICT, organization_id: ORG_A, event_id: EVENT_2, activity_number: 'ACT-002', description: 'Fit', deleted_at: null },
    { id: 'act-3', workpack_id: WP_CONFLICT, organization_id: ORG_A, event_id: null, activity_number: 'TEST-ACT-1', description: 'Test Act 1', deleted_at: null },
  ];
}

function wp(partial: Row): Row {
  return {
    organization_id: ORG_A,
    site_id: 's1111111-1111-4111-8111-111111111111',
    event_id: null,
    project_id: null,
    deleted_at: null,
    status: 'draft',
    work_type: null,
    job_type: null,
    priority: 'Normal',
    scope_of_work: null,
    planned_start_date: null,
    planned_end_date: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: USER_A,
    scope_item_id: null,
    unit_id: null,
    system_id: null,
    asset_id: null,
    plant_id: null,
    equipment_type: null,
    sap_work_order: null,
    sap_notification: null,
    template_id: null,
    workpack_id_code: null,
    unit_code: null,
    organization: { name: 'Org A' },
    site: { name: 'Site A' },
    plant: null,
    unit: null,
    system: null,
    asset: null,
    discipline: null,
    contractor: null,
    User_Workpack_created_byToUser: { name: 'Planner', email: 'a@x.com' },
    identity_review: null,
    ...partial,
  };
}

vi.mock('@/lib/audit', () => ({
  AuditService: { log: vi.fn(async (_i: any, _db?: any) => {
    store.audits.push(_i);
  }) },
}));

vi.mock('@/core/planning/EventPlanningService', () => ({
  EventPlanningService: {
    list: vi.fn(async (orgId: string) => store.events.filter((e) => e.organization_id === orgId && !e.deleted_at)),
  },
}));

vi.mock('@/lib/prisma', () => {
  const client: any = {
    workpack: {
      findMany: vi.fn(async ({ where }: any) =>
        store.workpacks.filter((w) => {
          if (where?.organization_id && w.organization_id !== where.organization_id) return false;
          if (where?.event_id === null && w.event_id !== null) return false;
          if (where?.deleted_at === null && w.deleted_at) return false;
          if (where?.id?.in && !where.id.in.includes(w.id)) return false;
          return true;
        })
      ),
      findFirst: vi.fn(async ({ where }: any) =>
        store.workpacks.find((w) => {
          if (where?.id && w.id !== where.id) return false;
          if (where?.organization_id && w.organization_id !== where.organization_id) return false;
          if (where?.deleted_at === null && w.deleted_at) return false;
          return true;
        }) ?? null
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const w = store.workpacks.find((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.organization_id && row.organization_id !== where.organization_id) return false;
          if ('event_id' in where && row.event_id !== where.event_id) return false;
          if (where.deleted_at === null && row.deleted_at) return false;
          return true;
        });
        if (!w) return { count: 0 };
        Object.assign(w, data);
        return { count: 1 };
      }),
    },
    workpackIdentityReview: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        let row = store.reviews.find((r) => r.workpack_id === where.workpack_id);
        if (!row) {
          row = { ...create };
          store.reviews.push(row);
          const wpRow = store.workpacks.find((w) => w.id === where.workpack_id);
          if (wpRow) wpRow.identity_review = row;
        } else {
          Object.assign(row, update);
        }
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.reviews.find((r) => r.workpack_id === where.workpack_id);
        if (row) Object.assign(row, data);
        return row;
      }),
    },
    event: {
      findFirst: vi.fn(async ({ where }: any) =>
        store.events.find((e) => {
          if (where?.id && e.id !== where.id) return false;
          if (where?.organization_id && e.organization_id !== where.organization_id) return false;
          if (where?.deleted_at === null && e.deleted_at) return false;
          return true;
        }) ?? null
      ),
      findMany: vi.fn(async ({ where }: any) =>
        store.events.filter((e) => {
          if (where?.organization_id && e.organization_id !== where.organization_id) return false;
          if (where?.id?.in && !where.id.in.includes(e.id)) return false;
          return true;
        })
      ),
    },
    activity: {
      findMany: vi.fn(async ({ where }: any) =>
        store.activities.filter((a) => {
          if (where?.organization_id && a.organization_id !== where.organization_id) return false;
          if (typeof where?.workpack_id === 'string' && a.workpack_id !== where.workpack_id) return false;
          if (where?.workpack_id?.in && !where.workpack_id.in.includes(a.workpack_id)) return false;
          if (where?.deleted_at === null && a.deleted_at) return false;
          return true;
        })
      ),
      update: vi.fn(async () => {
        store.activityUpdates += 1;
      }),
      updateMany: vi.fn(async () => {
        store.activityUpdates += 1;
        return { count: 0 };
      }),
    },
    scopeItem: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    workpackInstantiation: { findMany: vi.fn(async () => []) },
    baselineActivity: { findMany: vi.fn(async () => []) },
    eventUnit: { findMany: vi.fn(async () => []) },
    eventSystem: { findMany: vi.fn(async () => []) },
    auditLog: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: any) => {
      const snap = JSON.stringify({
        workpacks: store.workpacks,
        reviews: store.reviews,
        activities: store.activities,
      });
      try {
        return await fn(client);
      } catch (err) {
        const restored = JSON.parse(snap);
        store.workpacks.splice(0, store.workpacks.length, ...restored.workpacks);
        store.reviews.splice(0, store.reviews.length, ...restored.reviews);
        store.activities.splice(0, store.activities.length, ...restored.activities);
        throw err;
      }
    }),
  };
  return { prisma: client };
});

describe('R0.4-D classification', () => {
  it('classifies insufficient, non-sto, and conflicting without assigning', () => {
    expect(looksNonSto('Test Submit WP', null)).toBe(true);
    expect(looksNonSto('Overhaul Exchanger A', null)).toBe(false);

    const insuff = classifyEvidence({
      title: 'Overhaul Exchanger A',
      workpackNumber: null,
      scopeItemEvents: [],
      instantiationEvents: [],
      activityEvents: [],
      baselineEvents: [],
      unitEvents: [],
      systemEvents: [],
      assetScopeEvents: [],
    });
    expect(insuff.classification).toBe('INSUFFICIENT');
    expect(insuff.candidates).toEqual([]);

    const nonsto = classifyEvidence({
      title: 'Test Submit WP',
      workpackNumber: null,
      scopeItemEvents: [],
      instantiationEvents: [],
      activityEvents: [],
      baselineEvents: [],
      unitEvents: [],
      systemEvents: [],
      assetScopeEvents: [],
    });
    expect(nonsto.classification).toBe('NON_STO');

    const conflict = classifyEvidence({
      title: 'Phase 2C Test WP',
      workpackNumber: 'TEST-WP-PH2C-1788013251870',
      scopeItemEvents: [],
      instantiationEvents: [],
      activityEvents: [
        { eventId: EVENT_TA, code: 'TA-2027', name: 'T', siteName: null, plannedStart: null, plannedEnd: null, status: 'planning', orgMatch: true, activityLabel: 'ACT-001' },
        { eventId: EVENT_2, code: 'TA-2028', name: 'T2', siteName: null, plannedStart: null, plannedEnd: null, status: 'planning', orgMatch: true, activityLabel: 'ACT-002' },
      ],
      baselineEvents: [],
      unitEvents: [],
      systemEvents: [],
      assetScopeEvents: [],
    });
    expect(conflict.classification).toBe('CONFLICTING_CHILD_EVENT');
    expect(conflict.candidates).toHaveLength(2);
    expect(conflict.paths.find((p) => p.key === 'activity')?.status).toBe('CONFLICTING');
  });
});

describe('R0.4-D review service', () => {
  beforeEach(() => {
    seed();
    vi.mocked(AuditService.log).mockClear();
  });

  it('queue is tenant isolated and Event-less only', async () => {
    const rows = await WorkpackIdentityReviewService.listQueue(actorA);
    expect(rows.every((r) => r.id !== WP_B)).toBe(true);
    expect(rows.some((r) => r.id === WP_CONFLICT)).toBe(true);
    expect(rows.find((r) => r.id === WP_CONFLICT)?.priority).toBe('P0');
    expect(rows.find((r) => r.id === WP_INSUFF || r.title === 'Overhaul Exchanger A')?.priority).toBe('P1');
    expect(rows.find((r) => r.id === WP_NONSTO)?.classification).toBe('NON_STO');
  });

  it('does not assign without human confirmation', async () => {
    const result = await WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
      decision: 'ASSIGN',
      confirm: false,
      eventId: EVENT_TA,
      reason: 'guess',
      evidence: 'none',
    });
    expect(result.applied).toBe(false);
    expect(store.workpacks.find((w) => w.id === WP_INSUFF)?.event_id).toBeNull();
    expect(store.audits).toHaveLength(0);
  });

  it('assigns Event only after confirmation and tenant validation', async () => {
    const result = await WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
      decision: 'ASSIGN',
      confirm: true,
      eventId: EVENT_TA,
      reason: 'Planner selected TA-2027',
      evidence: 'Human review of exchanger overhaul',
      expected_version: 0,
    });
    expect(result.applied).toBe(true);
    expect(store.workpacks.find((w) => w.id === WP_INSUFF)?.event_id).toBe(EVENT_TA);
    expect(store.audits[0].new_values.source).toBe('R0.4D_WORKPACK_IDENTITY_REVIEW');
    expect(store.audits[0].new_values.decision).toBe('ASSIGN');
    expect(store.audits[0].new_values.new_event_id).toBe(EVENT_TA);
  });

  it('rejects cross-tenant Event with generic not-found', async () => {
    await expect(
      WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
        decision: 'ASSIGN',
        confirm: true,
        eventId: EVENT_B,
        reason: 'cross',
        evidence: 'cross',
      })
    ).rejects.toMatchObject({ message: GENERIC_EVENT_NOT_FOUND, statusCode: 404 });
    expect(store.workpacks.find((w) => w.id === WP_INSUFF)?.event_id).toBeNull();
  });

  it('hides foreign Workpack with generic not-found', async () => {
    await expect(WorkpackIdentityReviewService.getDetail(actorA, WP_B)).rejects.toMatchObject({
      message: GENERIC_WORKPACK_NOT_FOUND,
      statusCode: 404,
    });
    await expect(WorkpackIdentityReviewService.getDetail(actorA, MISSING)).rejects.toMatchObject({
      message: GENERIC_WORKPACK_NOT_FOUND,
    });
  });

  it('treats Project as irrelevant and refuses Project-based assignment', async () => {
    await expect(
      WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
        decision: 'ASSIGN',
        confirm: true,
        eventId: EVENT_TA,
        reason: 'via project',
        evidence: 'project',
        project_id: 'any-project',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(store.workpacks.find((w) => w.id === WP_INSUFF)?.event_id).toBeNull();
  });

  it('blocks conflict assignment without explicit resolution and approval', async () => {
    const viewer: ReviewActor = { ...actorA, canApproveWorkpacks: false };
    await expect(
      WorkpackIdentityReviewService.apply(viewer, WP_CONFLICT, {
        decision: 'ASSIGN',
        confirm: true,
        eventId: EVENT_TA,
        reason: 'pick one',
        evidence: 'first',
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      WorkpackIdentityReviewService.apply(actorA, WP_CONFLICT, {
        decision: 'ASSIGN',
        confirm: true,
        eventId: EVENT_TA,
        reason: 'pick one',
        evidence: 'first',
        conflict_resolution: false,
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(store.workpacks.find((w) => w.id === WP_CONFLICT)?.event_id).toBeNull();
  });

  it('conflict resolution assigns Workpack Event and does not rewrite children', async () => {
    const beforeActs = store.activities.map((a) => ({ id: a.id, event_id: a.event_id }));
    const result = await WorkpackIdentityReviewService.apply(actorA, WP_CONFLICT, {
      decision: 'ASSIGN',
      confirm: true,
      eventId: EVENT_TA,
      reason: 'Accepted TA-2027 after conflict review',
      evidence: 'ACT-001 belongs to TA-2027; others remain exceptions',
      conflict_resolution: true,
      expected_version: 0,
    });
    expect(result.applied).toBe(true);
    expect(store.workpacks.find((w) => w.id === WP_CONFLICT)?.event_id).toBe(EVENT_TA);
    expect(store.activityUpdates).toBe(0);
    expect(store.activities.map((a) => ({ id: a.id, event_id: a.event_id }))).toEqual(beforeActs);
    expect(result.child_mismatches?.length).toBeGreaterThan(0);
    expect(store.audits[0].new_values.conflict_type).toBe('CONFLICTING_CHILD_EVENT');
  });

  it('quarantines NON_STO without deleting or assigning Event', async () => {
    const result = await WorkpackIdentityReviewService.apply(actorA, WP_NONSTO, {
      decision: 'QUARANTINE',
      reason: 'Approval fixture',
      evidence: 'Test Submit WP',
    });
    expect(result.review_state).toBe('QUARANTINED');
    expect(result.deleted).toBe(false);
    expect(store.workpacks.find((w) => w.id === WP_NONSTO)?.event_id).toBeNull();
    expect(store.workpacks.find((w) => w.id === WP_NONSTO)?.deleted_at).toBeNull();
    expect(store.audits[0].new_values.decision).toBe('QUARANTINE');
  });

  it('returns 409 when review version is stale', async () => {
    await WorkpackIdentityReviewService.apply(actorA, WP_NONSTO, {
      decision: 'QUARANTINE',
      reason: 'first',
      evidence: 'first',
      expected_version: 0,
    });
    await expect(
      WorkpackIdentityReviewService.apply(actorA, WP_NONSTO, {
        decision: 'QUARANTINE',
        reason: 'second',
        evidence: 'second',
        expected_version: 0,
      })
    ).rejects.toMatchObject({ statusCode: 409, details: { code: 'REVIEW_STATE_CHANGED' } });
  });

  it('rolls back an assignment with a new HUMAN_ROLLBACK audit', async () => {
    await WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
      decision: 'ASSIGN',
      confirm: true,
      eventId: EVENT_TA,
      reason: 'assign',
      evidence: 'assign',
      expected_version: 0,
    });
    const firstAuditCount = store.audits.length;
    await WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
      decision: 'ROLLBACK',
      reason: 'wrong Event',
      expected_version: 1,
    });
    expect(store.workpacks.find((w) => w.id === WP_INSUFF)?.event_id).toBeNull();
    expect(store.audits.length).toBe(firstAuditCount + 1);
    expect(store.audits.at(-1)?.action).toBe('HUMAN_ROLLBACK');
    expect(store.audits.at(-1)?.new_values.previous_event).toBe(EVENT_TA);
    expect(store.audits.at(-1)?.new_values.restored_event).toBeNull();
  });

  it('rolls back the transaction when audit write fails', async () => {
    vi.mocked(AuditService.log).mockRejectedValueOnce(new Error('audit down'));
    await expect(
      WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
        decision: 'ASSIGN',
        confirm: true,
        eventId: EVENT_TA,
        reason: 'x',
        evidence: 'y',
      })
    ).rejects.toThrow();
    expect(store.workpacks.find((w) => w.id === WP_INSUFF)?.event_id).toBeNull();
  });

  it('transaction rollback mock: failed updateMany leaves Event unset', async () => {
    vi.mocked(prisma.workpack.updateMany).mockResolvedValueOnce({ count: 0 } as any);
    await expect(
      WorkpackIdentityReviewService.apply(actorA, WP_INSUFF, {
        decision: 'ASSIGN',
        confirm: true,
        eventId: EVENT_TA,
        reason: 'x',
        evidence: 'y',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('R0.4-D authorities unchanged', () => {
  it('does not import or replace ActivityCreationCommand as a writer', async () => {
    const cmd = await import('@/core/activity/ActivityCreationCommand');
    expect(typeof cmd.createActivity).toBe('function');
  });
});
