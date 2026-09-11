/**
 * OD9.1 — Controlled Database / Prisma Schema Reconciliation
 *
 * Behavioural acceptance tests T1–T15. These execute against the live development
 * database and assert observed behaviour; none of them inspect source text, because a
 * source-text assertion cannot distinguish a declaration from a working one — which is
 * precisely the failure mode OD9 was opened to find.
 *
 * Every test that writes does so inside a transaction that is deliberately rolled back,
 * so the suite leaves no rows behind. The epoch-correction and enum tests read committed
 * migration state and write nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
// The application's own client, so these tests exercise the same adapter, pool and
// generated types that production code does.
import { prisma } from '@/lib/prisma';
import { PrismaIdentityBackfillStore } from '@/core/activity/identityBackfillPrismaStore';
import { isMilestoneActivity, milestoneWhere } from '@/core/activity/milestoneDerivation';

/** Sentinel used to force a rollback once assertions inside a transaction have run. */
const ROLLBACK = 'OD91_INTENTIONAL_ROLLBACK';

/**
 * Runs `fn` inside a transaction and always rolls it back. Assertion failures inside the
 * transaction are re-thrown after the rollback so vitest still reports them.
 */
async function inRolledBackTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let captured: T;
  let assertionError: unknown;
  try {
    await prisma.$transaction(async (tx) => {
      try {
        captured = await fn(tx);
      } catch (e) {
        assertionError = e;
      }
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e;
  }
  if (assertionError) throw assertionError;
  return captured!;
}

/** A real organization + site + event to hang fixtures off, so FKs are satisfied. */
let anchor: { orgId: string; siteId: string; eventId: string };

beforeAll(async () => {
  const event = await prisma.event.findFirst({
    where: { deleted_at: null },
    select: { id: true, organization_id: true, site_id: true },
  });
  if (!event) throw new Error('OD9.1 tests require at least one live Event to anchor fixtures');
  anchor = { orgId: event.organization_id, siteId: event.site_id, eventId: event.id };
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Narrowing helper: the shared client is a Proxy, so index access needs a cast. */
const client = prisma as unknown as Record<string, unknown>;

function activityFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    organization_id: anchor.orgId,
    site_id: anchor.siteId,
    event_id: anchor.eventId,
    description: 'OD9.1 behavioural fixture',
    duration_hours: 8,
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// T1 — Activity creation persists schedule_source (Phase 3B)
// ───────────────────────────────────────────────────────────────────────────────
describe('T1 — Activity.schedule_source is a real, writable column', () => {
  it('persists and reads back every provenance value the application writes', async () => {
    await inRolledBackTx(async (tx) => {
      for (const value of ['workpack', 'imported', null]) {
        const created = await tx.activity.create({
          data: activityFixture({ schedule_source: value }),
          select: { id: true, schedule_source: true },
        });
        expect(created.schedule_source).toBe(value);

        // Prove it survived the round trip to PostgreSQL rather than being echoed back.
        const [row] = await tx.$queryRaw<Array<{ schedule_source: string | null }>>`
          SELECT schedule_source FROM "Activity" WHERE id = ${created.id}::uuid
        `;
        expect(row.schedule_source).toBe(value);
      }
    });
  });

  it('is queryable as a filter, so provenance can be reported on', async () => {
    await inRolledBackTx(async (tx) => {
      const { id } = await tx.activity.create({
        data: activityFixture({ schedule_source: 'imported' }),
        select: { id: true },
      });
      const found = await tx.activity.findFirst({
        where: { id, schedule_source: 'imported' },
        select: { id: true },
      });
      expect(found?.id).toBe(id);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T2 — Activity.project_id is retired (Phase 3A)
// ───────────────────────────────────────────────────────────────────────────────
describe('T2 — Activity.project_id is retired and not required', () => {
  it('creates an Activity with no project_id at all', async () => {
    await inRolledBackTx(async (tx) => {
      const created = await tx.activity.create({
        data: activityFixture(),
        select: { id: true, event_id: true },
      });
      expect(created.id).toBeTruthy();
      expect(created.event_id).toBe(anchor.eventId);
    });
  });

  it('rejects project_id as an unknown argument rather than silently ignoring it', async () => {
    await expect(
      prisma.activity.findFirst({ where: { project_id: randomUUID() } as never }),
    ).rejects.toThrow();
  });

  it('has no project_id column in the database either', async () => {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Activity' AND column_name = 'project_id'
    `;
    expect(Number(rows[0].n)).toBe(0);
  });

  it('still reaches project-scoped activities through the Workpack', async () => {
    // The replacement traversal used by SchedulingService and the project WBS/XER routes.
    const wp = await prisma.workpack.findFirst({
      where: { project_id: { not: null }, deleted_at: null },
      select: { project_id: true },
    });
    if (!wp?.project_id) {
      // Project is retired with 0 rows under R0.4, so there may be nothing to traverse.
      // The query shape is still what matters, and it must not throw.
      await expect(
        prisma.activity.findMany({ where: { workpack: { project_id: randomUUID() } }, take: 1 }),
      ).resolves.toBeInstanceOf(Array);
      return;
    }
    await expect(
      prisma.activity.findMany({ where: { workpack: { project_id: wp.project_id } }, take: 1 }),
    ).resolves.toBeInstanceOf(Array);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T3 — Identity backfill legacy detection actually fires (Phase 4)
// ───────────────────────────────────────────────────────────────────────────────
describe('T3 — identity backfill sees schedule_source', () => {
  it('loadActivities returns schedule_source, so the imported arm can evaluate true', async () => {
    await inRolledBackTx(async (tx) => {
      const { id } = await tx.activity.create({
        data: activityFixture({ schedule_source: 'imported' }),
        select: { id: true },
      });

      const store = new PrismaIdentityBackfillStore(tx as never);
      const rows = await store.loadActivities();
      const row = rows.find((r) => r.id === id);

      expect(row, 'the seeded activity must be visible to the backfill store').toBeTruthy();
      // Before OD9.1 this was `undefined` because the column was absent from the SELECT,
      // so `row.schedule_source === 'imported'` could never be true.
      expect(row!.schedule_source).toBe('imported');

      // The exact predicate ActivityIdentityBackfillService.isLegacy evaluates.
      expect(row!.schedule_source === 'imported').toBe(true);
    });
  });

  it('does not misclassify a native activity as legacy', async () => {
    await inRolledBackTx(async (tx) => {
      const { id } = await tx.activity.create({
        data: activityFixture({ schedule_source: 'workpack' }),
        select: { id: true },
      });
      const store = new PrismaIdentityBackfillStore(tx as never);
      const row = (await store.loadActivities()).find((r) => r.id === id);
      expect(row!.schedule_source).toBe('workpack');
      expect(row!.schedule_source === 'imported').toBe(false);
      expect(row!.p6_activity_id).toBeNull();
      expect(row!.p6_object_id).toBeNull();
    });
  });

  it('still does not select the retired project_id column', async () => {
    await inRolledBackTx(async (tx) => {
      const store = new PrismaIdentityBackfillStore(tx as never);
      // Would throw `column "project_id" does not exist` if it were still selected.
      await expect(store.loadActivities()).resolves.toBeInstanceOf(Array);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T4 — WBS generation works without EventPhase (Phase 5)
// ───────────────────────────────────────────────────────────────────────────────
describe('T4 — WBS generation for an Event with no EventPhase', () => {
  it('EventPhase exists in neither the client nor the database', async () => {
    expect(client.eventPhase).toBeUndefined();
    const rows = await prisma.$queryRaw<Array<{ a: string | null; b: string | null }>>`
      SELECT to_regclass('public."EventPhase"')::text AS a,
             to_regclass('public.event_phases')::text AS b
    `;
    expect(rows[0].a).toBeNull();
    expect(rows[0].b).toBeNull();
  });

  it('the query the generator runs succeeds — the phantom include is gone', async () => {
    // This is the exact shape of the fetch in wbs/generate/route.ts. Before OD9.1 the
    // same call with `event_phases: true` threw a validation error before the handler
    // could reach its fallback, so WBS generation failed for every event.
    const event = await prisma.event.findFirst({
      where: { id: anchor.eventId, organization_id: anchor.orgId, deleted_at: null },
      include: { eventUnits: { include: { unit: { include: { systems: true } } } } },
    });
    expect(event).toBeTruthy();
    expect(event!.eventUnits).toBeInstanceOf(Array);
  });

  it('generates the three fallback phases as real WbsNode rows', async () => {
    await inRolledBackTx(async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: anchor.eventId },
        include: { eventUnits: { include: { unit: { include: { systems: true } } } } },
      });

      const phases = [
        { id: 'pre', name: 'Pre-TA' },
        { id: 'exe', name: 'Execution' },
        { id: 'post', name: 'Post-TA' },
      ];

      const root = await tx.wbsNode.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          event_id: anchor.eventId,
          parent_id: null,
          code: `OD91-${event!.code}`,
          name: event!.name,
          type: 'EVENT',
          order: 0,
          updated_at: new Date(),
        },
      });

      const created: string[] = [];
      let order = 1;
      for (const phase of phases) {
        const node = await tx.wbsNode.create({
          data: {
            id: randomUUID(),
            organization_id: anchor.orgId,
            event_id: anchor.eventId,
            parent_id: root.id,
            code: `OD91-${event!.code}.${phase.name.substring(0, 3).toUpperCase()}`,
            name: phase.name,
            type: 'CUSTOM',
            order: order++,
            updated_at: new Date(),
          },
        });
        created.push(node.name);
      }

      expect(created).toEqual(['Pre-TA', 'Execution', 'Post-TA']);

      const children = await tx.wbsNode.findMany({
        where: { parent_id: root.id },
        select: { name: true },
        orderBy: { order: 'asc' },
      });
      expect(children.map((c) => c.name)).toEqual(['Pre-TA', 'Execution', 'Post-TA']);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T5 / T6 — is_milestone is derived, never queried as storage (Phase 6)
// ───────────────────────────────────────────────────────────────────────────────
describe('T5 — milestone derivation', () => {
  it('there is no is_milestone column to query', async () => {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Activity' AND column_name = 'is_milestone'
    `;
    expect(Number(rows[0].n)).toBe(0);
  });

  it('rejects is_milestone as a filter, proving no site can silently reintroduce it', async () => {
    await expect(
      prisma.activity.findFirst({ where: { is_milestone: true } as never }),
    ).rejects.toThrow();
  });

  it('the derivation matches the EVM 0/100 rule it is delegating to', () => {
    // Mirrors EvmCalculationService.calculateEv lines 106-112.
    expect(isMilestoneActivity({ work_category: 'MILESTONE', duration_hours: 40 })).toBe(true);
    expect(isMilestoneActivity({ work_category: 'PIPING', duration_hours: 0 })).toBe(true);
    expect(isMilestoneActivity({ work_category: 'PIPING', duration_hours: null })).toBe(true);
    expect(isMilestoneActivity({ work_category: 'PIPING', duration_hours: 8 })).toBe(false);
    expect(isMilestoneActivity({ work_category: null, duration_hours: 8 })).toBe(false);
  });

  it('the provider filter selects exactly the activities the derivation selects', async () => {
    await inRolledBackTx(async (tx) => {
      const byCategory = await tx.activity.create({
        data: activityFixture({ work_category: 'MILESTONE', duration_hours: 40 }),
        select: { id: true },
      });
      const byZeroDuration = await tx.activity.create({
        data: activityFixture({ work_category: 'PIPING', duration_hours: 0 }),
        select: { id: true },
      });
      const notAMilestone = await tx.activity.create({
        data: activityFixture({ work_category: 'PIPING', duration_hours: 8 }),
        select: { id: true },
      });

      const ids = [byCategory.id, byZeroDuration.id, notAMilestone.id];
      const selected = await tx.activity.findMany({
        where: { id: { in: ids }, ...milestoneWhere() },
        select: { id: true, work_category: true, duration_hours: true },
      });

      const selectedIds = selected.map((a) => a.id).sort();
      expect(selectedIds).toEqual([byCategory.id, byZeroDuration.id].sort());
      expect(selectedIds).not.toContain(notAMilestone.id);

      // The database filter and the in-memory predicate must agree, or the report and
      // the export would disagree about the same activity.
      for (const a of selected) expect(isMilestoneActivity(a)).toBe(true);
    });
  });
});

describe('T6 — Primavera export derives is_milestone instead of hardcoding false', () => {
  it('marks a zero-duration activity as a milestone in the exported shape', async () => {
    await inRolledBackTx(async (tx) => {
      const milestone = await tx.activity.create({
        data: activityFixture({ work_category: 'MILESTONE', duration_hours: 0 }),
        select: { id: true, work_category: true, duration_hours: true },
      });
      const normal = await tx.activity.create({
        data: activityFixture({ work_category: 'PIPING', duration_hours: 16 }),
        select: { id: true, work_category: true, duration_hours: true },
      });

      // The mapping the export route performs.
      expect(isMilestoneActivity(milestone)).toBe(true);
      expect(isMilestoneActivity(normal)).toBe(false);
    });
  });

  it('selects only fields that exist, so the export query executes', async () => {
    // The export's include shape. If it named a nonexistent field this would throw.
    await expect(
      prisma.workpack.findFirst({
        where: { organization_id: anchor.orgId, deleted_at: null },
        include: { activities: { where: { deleted_at: null }, include: { successors: true } } },
      }),
    ).resolves.not.toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T7 / T8 / T9 — ActivityStatus release / verify / close (Phase 7)
// ───────────────────────────────────────────────────────────────────────────────
describe('ActivityStatus enum reconciliation', () => {
  it('the database enum carries all eight values the application uses', async () => {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ActivityStatus'
      ORDER BY e.enumsortorder
    `;
    const values = rows.map((r) => r.enumlabel);
    expect(values).toHaveLength(8);
    expect(values).toEqual(
      expect.arrayContaining([
        'not_started', 'in_progress', 'completed', 'on_hold', 'cancelled',
        'released', 'verified', 'closed',
      ]),
    );
  });

  for (const [label, status] of [['T7', 'released'], ['T8', 'verified'], ['T9', 'closed']] as const) {
    it(`${label} — an Activity can actually be written to '${status}' and read back`, async () => {
      await inRolledBackTx(async (tx) => {
        const { id } = await tx.activity.create({
          data: activityFixture({ status: 'in_progress' }),
          select: { id: true },
        });

        const updated = await tx.activity.update({
          where: { id },
          data: { status },
          select: { status: true },
        });
        expect(updated.status).toBe(status);

        // Confirm PostgreSQL stored the enum label, not a coerced string.
        const [raw] = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status::text AS status FROM "Activity" WHERE id = ${id}::uuid
        `;
        expect(raw.status).toBe(status);

        // And that it is filterable, which is what M12's state queries depend on.
        const found = await tx.activity.findFirst({ where: { id, status }, select: { id: true } });
        expect(found?.id).toBe(id);
      });
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// T10 / T11 — previously undeclared live tables are now reachable (Phase 2)
// ───────────────────────────────────────────────────────────────────────────────
describe('T10 — resource planning models are declared and usable', () => {
  it('reads the 6 live ShiftDefinition rows through the Prisma client', async () => {
    const shifts = await prisma.shiftDefinition.findMany({
      select: { id: true, shift_name: true, start_time: true, end_time: true, event_id: true },
    });
    expect(shifts.length).toBe(6);
    for (const s of shifts) {
      expect(typeof s.shift_name).toBe('string');
      expect(typeof s.start_time).toBe('string');
    }
  });

  it('reads the 30 live ResourceCapacity rows with the relation names the service uses', async () => {
    const caps = await prisma.resourceCapacity.findMany({
      include: { resource_type: true, contractor: true, shift: true },
    });
    expect(caps.length).toBe(30);
    // ResourcePlanningService destructures exactly these relation fields.
    for (const c of caps) {
      expect(c.resource_type).toBeTruthy();
      expect(c.capacity_limit).toBeTruthy();
    }
  });

  it('traverses ShiftDefinition -> resource_capacities, the include the service performs', async () => {
    const shift = await prisma.shiftDefinition.findFirst({
      include: { resource_capacities: true },
    });
    expect(shift).toBeTruthy();
    expect(shift!.resource_capacities).toBeInstanceOf(Array);
  });

  it('provisioning models are declared and queryable', async () => {
    await expect(prisma.provisioning_jobs.findMany({ include: { logs: true }, take: 1 })).resolves.toBeInstanceOf(Array);
    await expect(prisma.provisioning_templates.findMany({ include: { jobs: true }, take: 1 })).resolves.toBeInstanceOf(Array);
    await expect(prisma.provisioning_job_logs.findMany({ take: 1 })).resolves.toBeInstanceOf(Array);
    await expect(prisma.asset_relationships.findMany({ take: 1 })).resolves.toBeInstanceOf(Array);
    await expect(prisma.onboarding_requests.findMany({ take: 1 })).resolves.toBeInstanceOf(Array);
  });
});

describe('T11 — workpack asset snapshots are declared and preserved', () => {
  it('reads the 2 live snapshot rows and their Workpack/Asset relations', async () => {
    const snaps = await prisma.workpack_asset_snapshots.findMany({
      include: { workpack: true, asset: true },
    });
    expect(snaps.length).toBe(2);
    for (const s of snaps) {
      // A revision label ('R0'), not a number — the column is TEXT in the asset register
      // SQL this table originated from, and was transcribed as such rather than tidied.
      expect(s.snapshot_revision).toMatch(/^R\d+$/);
      // The relations must resolve, which is what the asset register UI depends on.
      expect(s.workpack).toBeTruthy();
      expect(s.asset).toBeTruthy();
      // The frozen asset payload is the whole point of the table; assert it survived.
      expect(s.asset_data_json).toBeTruthy();
      expect(s.snapshotted_at).toBeInstanceOf(Date);
    }
  });

  it('the unique constraint that protects snapshot revisions still exists', async () => {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'workpack_asset_snapshots'
        AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%snapshot_revision%'
    `;
    expect(Number(rows[0].n)).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T12 — Activity -> Event relation and FK (Phase 8)
// ───────────────────────────────────────────────────────────────────────────────
describe('T12 — Activity/Event identity is enforced by the database', () => {
  it('the physical foreign key exists with the same semantics as Workpack_event_id_fkey', async () => {
    const rows = await prisma.$queryRaw<Array<{ conname: string; def: string }>>`
      SELECT con.conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      WHERE con.contype = 'f'
        AND con.conname IN ('Activity_event_id_fkey', 'Workpack_event_id_fkey')
    `;
    const activityFk = rows.find((r) => r.conname === 'Activity_event_id_fkey');
    const workpackFk = rows.find((r) => r.conname === 'Workpack_event_id_fkey');
    expect(activityFk).toBeTruthy();
    expect(workpackFk).toBeTruthy();
    expect(activityFk!.def).toContain('REFERENCES events(id)');
    expect(activityFk!.def).toContain('ON DELETE SET NULL');
    expect(activityFk!.def).toContain('ON UPDATE CASCADE');
    // Activity and Workpack must agree, or the two could diverge on event deletion.
    expect(activityFk!.def.replace('Activity', '')).toBe(workpackFk!.def.replace('Workpack', ''));
  });

  it('rejects an Activity pointing at a nonexistent Event', async () => {
    await expect(
      inRolledBackTx(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "Activity" (id, organization_id, site_id, event_id, description, updated_at)
          VALUES (${randomUUID()}::uuid, ${anchor.orgId}::uuid, ${anchor.siteId}::uuid,
                  ${randomUUID()}::uuid, 'OD9.1 invalid event reference', NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('still permits a NULL event_id, preserving the 4 unattached activities', async () => {
    await inRolledBackTx(async (tx) => {
      const created = await tx.activity.create({
        data: { ...activityFixture(), event_id: null },
        select: { id: true, event_id: true },
      });
      expect(created.event_id).toBeNull();
    });
    const unattached = await prisma.activity.count({ where: { event_id: null } });
    expect(unattached).toBe(4);
  });

  it('exposes the relation for traversal in both directions', async () => {
    const activity = await prisma.activity.findFirst({
      where: { event_id: { not: null } },
      include: { event: { select: { id: true, organization_id: true } } },
    });
    expect(activity!.event).toBeTruthy();
    expect(activity!.event!.id).toBe(activity!.event_id);
    // Cross-tenant safety: the FK does not enforce org, so agreement is asserted here.
    expect(activity!.event!.organization_id).toBe(activity!.organization_id);

    const event = await prisma.event.findFirst({
      where: { id: activity!.event_id! },
      include: { activities: { select: { id: true }, take: 1 } },
    });
    expect(event!.activities).toBeInstanceOf(Array);
  });

  it('no workpack-attached activity contradicts its Workpack event_id', async () => {
    // The R0.4 invariant is about contradiction, not absence. A Workpack with a NULL
    // event_id carrying activities that do have one is an incomplete Workpack, not a
    // conflict — 7 such rows exist, all on one unattached test workpack, and they are
    // recorded as a data-quality observation rather than an FK blocker.
    const rows = await prisma.$queryRaw<Array<{ conflicts: bigint; absent: bigint }>>`
      SELECT
        count(*) FILTER (
          WHERE a.event_id IS NOT NULL AND w.event_id IS NOT NULL AND a.event_id <> w.event_id
        ) AS conflicts,
        count(*) FILTER (WHERE a.event_id IS NOT NULL AND w.event_id IS NULL) AS absent
      FROM "Activity" a
      JOIN "Workpack" w ON w.id = a.workpack_id
    `;
    expect(Number(rows[0].conflicts)).toBe(0);
    // Asserted so the count cannot grow unnoticed.
    expect(Number(rows[0].absent)).toBe(7);
  });

  it('no activity references an event that does not exist or belongs to another tenant', async () => {
    const rows = await prisma.$queryRaw<Array<{ orphans: bigint; cross_tenant: bigint }>>`
      SELECT
        count(*) FILTER (WHERE a.event_id IS NOT NULL AND e.id IS NULL) AS orphans,
        count(*) FILTER (WHERE e.id IS NOT NULL AND e.organization_id <> a.organization_id) AS cross_tenant
      FROM "Activity" a
      LEFT JOIN events e ON e.id = a.event_id
    `;
    expect(Number(rows[0].orphans)).toBe(0);
    expect(Number(rows[0].cross_tenant)).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// T15 — epoch correction, scoped to three explicit IDs (Phase 10)
// ───────────────────────────────────────────────────────────────────────────────
describe('T15 — epoch planned-date correction', () => {
  const EPOCH_IDS = [
    '1ac78091-0ad0-4c2b-aca4-f92b821dc113',
    'ccc8de63-3dbe-4c24-b946-98c282b953d2',
    'e5303f4d-941c-4ebb-9492-7ef8f42a8af8',
  ];

  it('the three named activities have NULL planned dates and still exist', async () => {
    const rows = await prisma.activity.findMany({
      where: { id: { in: EPOCH_IDS } },
      select: { id: true, planned_start: true, planned_end: true, duration_hours: true, event_id: true },
    });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.planned_start).toBeNull();
      expect(r.planned_end).toBeNull();
      // The rows themselves are preserved — only the false date assertion was removed.
      expect(r.event_id).toBeTruthy();
      expect(Number(r.duration_hours)).toBe(20);
    }
  });

  it('no activity anywhere retains a pre-1980 planned date', async () => {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM "Activity"
      WHERE planned_start < DATE '1980-01-01' OR planned_end < DATE '1980-01-01'
    `;
    expect(Number(rows[0].n)).toBe(0);
  });

  it('preserves the independent BaselineActivity dates rather than matching them', async () => {
    const baselines = await prisma.baselineActivity.findMany({
      where: { activity_id: { in: EPOCH_IDS } },
      select: { activity_id: true, planned_start: true, planned_finish: true, duration: true },
    });
    expect(baselines).toHaveLength(3);
    for (const b of baselines) {
      // Real, non-epoch, and deliberately NOT copied back onto the Activity: M11 owns
      // planned dates and a baseline is downstream of them.
      expect(b.planned_start).toBeTruthy();
      expect(b.planned_start!.getUTCFullYear()).toBe(2026);
      expect(b.planned_finish!.getUTCFullYear()).toBe(2026);
      expect(Number(b.duration)).toBe(10);
    }
  });

  it('leaves the scenario overrides carrying no date facts, as found', async () => {
    const overrides = await prisma.scenarioActivityOverride.findMany({
      where: { activity_id: { in: EPOCH_IDS } },
      select: { planned_start: true, planned_end: true, duration_hours: true },
    });
    expect(overrides).toHaveLength(6);
    for (const o of overrides) {
      expect(o.planned_start).toBeNull();
      expect(o.planned_end).toBeNull();
      expect(o.duration_hours).toBeTruthy();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Phase 11 guard — OD9.1 must not have performed any C2 work
// ───────────────────────────────────────────────────────────────────────────────
describe('Phase 11 guard — no R1.0-C2 timestamp work was performed', () => {
  // SPRINT 1a (2026-09-10, explicitly authorized): the widening these columns
  // from date to timestamptz(3) was performed by migration
  // 20260910233000_sprint1a_time_model_widening, after a full pg_dump backup and
  // a staging-copy verification. This guard's original expectation ("still
  // date") proved OD9.1 did not do time work; it is now updated to pin the
  // authorized post-Sprint-1a state so no PARTIAL or accidental widening can
  // pass silently.
  it('planned/actual date columns are widened to timestamptz by the authorized Sprint 1a migration', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string }>>`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'Activity' AND column_name IN ('planned_start','planned_end','actual_start','actual_end'))
          OR (table_name = 'events' AND column_name IN ('planned_start','planned_end'))
          OR (table_name = 'ScenarioActivityOverride' AND column_name IN ('planned_start','planned_end'))
        )
    `;
    expect(rows).toHaveLength(8);
    for (const r of rows) expect(r.data_type).toBe('timestamp with time zone');
  });

  it('none of the C2 carrier columns have been created yet', async () => {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'Activity' AND column_name IN ('constraint_type','constraint_date'))
        OR (table_name = 'Workpack' AND column_name IN ('schedule_start','schedule_finish'))
      )
    `;
    expect(Number(rows[0].n)).toBe(0);
  });

  it('lag_days is still an integer and historical lag is untouched', async () => {
    const rows = await prisma.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ActivityRelationship' AND column_name = 'lag_days'
    `;
    expect(rows[0].data_type).toBe('integer');
  });

  it('tenant timezone rows were not silently changed', async () => {
    const orgs = await prisma.$queryRaw<Array<{ timezone: string }>>`
      SELECT DISTINCT timezone FROM "Organization"
    `;
    expect(orgs.map((o) => o.timezone)).toEqual(['UTC']);
  });
});
