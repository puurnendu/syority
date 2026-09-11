/**
 * Phase 0 — stop the bleeding (E2E lineage audit §26 items 1–6 + menu wiring).
 *
 * Behavioural tests against live `syority` (dev) with explicit row cleanup —
 * TemplateLibraryService.instantiate, ScheduleBaselineService and the route
 * handlers under test use the global Prisma client, so the rollback-sentinel
 * pattern cannot contain them. Every created row is deleted in `finally`.
 *
 * Acceptance tests covered (audit §30): A1, A2, A3, A4, A10, A11, A13.
 * Item 2 (enqueue by event) is additionally covered by
 * src/core/schedule/__tests__/r04e-event-cpm-enqueue.test.ts.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';
import { ScheduleBaselineService } from '@/core/resources/ScheduleBaselineService';
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';
import { ExecutionReadinessService } from '@/core/execution/ExecutionReadinessService';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';
import { isLegacyProjectChainEnabled, LEGACY_PROJECT_CHAIN_FLAG } from '@/lib/legacyProjectChain';
import {
  buildBusinessNavigation,
  buildTenantShellNavigation,
  type NavGateContext,
} from '@/config/business-navigation';
import { TENANT_SHELL_SECTIONS } from '@/security/navigation';

// ── Mock only the queue (no Redis in test) and the HTTP guard layer ─────────
vi.mock('@/lib/queues', () => ({
  scheduleRecalculateQueue: { add: vi.fn(async () => ({})) },
  reportDeliveryQueue: { add: vi.fn(async () => ({})) },
  knowledgeEngineQueue: { add: vi.fn(async () => ({})) },
}));

const guardState = vi.hoisted(() => ({
  session: { user: { id: '', organization_id: '' } } as any,
}));

vi.mock('@/lib/apiGuard', () => ({
  guardApi: vi.fn(async () => ({ error: null })),
  orgScope: (session: any) => ({ orgId: session.user.organization_id, userId: session.user.id }),
}));

vi.mock('@/lib/withTenantGuard', () => ({
  withTenantGuard: (handler: any) => async (req: any, ctx: any) =>
    handler(req, { params: ctx?.params ?? ctx }, guardState.session),
}));

import { scheduleRecalculateQueue } from '@/lib/queues';
import { GET as punchGET } from '../app/api/projects/[id]/punch/route';
import { GET as metricsGET } from '../app/api/projects/[id]/schedule/metrics/route';

let anchor: {
  orgId: string; siteId: string; eventId: string; userId: string;
  assetId: string; disciplineId: string;
};

beforeAll(async () => {
  const event = await prisma.event.findFirst({
    where: { deleted_at: null },
    select: { id: true, organization_id: true, site_id: true },
    orderBy: { created_at: 'asc' },
  });
  if (!event) throw new Error('Phase 0 tests require at least one Event.');
  const user = await prisma.user.findFirst({
    where: { organization_id: event.organization_id },
    select: { id: true },
  });
  const asset = await prisma.asset.findFirst({
    where: { organization_id: event.organization_id, deleted_at: null },
    select: { id: true },
  });
  const discipline = await prisma.discipline.findFirst({
    where: { organization_id: event.organization_id },
    select: { id: true },
  });
  if (!user || !asset || !discipline) {
    throw new Error('Phase 0 tests require a User, an Asset and a Discipline in the Event organisation.');
  }
  anchor = {
    orgId: event.organization_id,
    siteId: event.site_id,
    eventId: event.id,
    userId: user.id,
    assetId: asset.id,
    disciplineId: discipline.id,
  };
  guardState.session = { user: { id: user.id, organization_id: event.organization_id } };
});

/** Track created rows and delete them in reverse dependency order. */
function createCleanup() {
  const activityIds: string[] = [];
  const relationshipIds: string[] = [];
  const workpackIds: string[] = [];
  const templateIds: string[] = [];
  const familyIds: string[] = [];
  const baselineIds: string[] = [];
  const materialLineIds: string[] = [];
  const blindIds: string[] = [];
  const projectIds: string[] = [];
  return {
    activityIds, relationshipIds, workpackIds, templateIds, familyIds,
    baselineIds, materialLineIds, blindIds, projectIds,
    async run() {
      if (relationshipIds.length)
        await prisma.activityRelationship.deleteMany({ where: { id: { in: relationshipIds } } });
      if (materialLineIds.length)
        await prisma.workpack_material_lines.deleteMany({ where: { id: { in: materialLineIds } } });
      if (blindIds.length)
        await prisma.blind.deleteMany({ where: { id: { in: blindIds } } });
      if (baselineIds.length) {
        await prisma.baselineActivity.deleteMany({ where: { baseline_id: { in: baselineIds } } });
        await prisma.scheduleBaseline.deleteMany({ where: { id: { in: baselineIds } } });
      }
      if (activityIds.length) {
        await prisma.activityResource.deleteMany({ where: { activity_id: { in: activityIds } } });
        await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
      }
      if (workpackIds.length)
        await prisma.workpack.deleteMany({ where: { id: { in: workpackIds } } });
      if (templateIds.length) {
        await prisma.workpack_template_activities.deleteMany({ where: { template_id: { in: templateIds } } });
        await prisma.workpack_template_logic_links.deleteMany({ where: { template_id: { in: templateIds } } });
        await prisma.workpack_templates.deleteMany({ where: { id: { in: templateIds } } });
      }
      if (familyIds.length)
        await prisma.templateFamily.deleteMany({ where: { id: { in: familyIds } } });
      if (projectIds.length)
        await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    },
  };
}

describe('Phase 0 / A1–A4 — template instantiation connects to the Event chain', () => {
  it('A1: instantiated activities carry event_id, asset_id, discipline_id', async () => {
    const c = createCleanup();
    try {
      const family = await prisma.templateFamily.create({
        data: { organization_id: anchor.orgId, name: 'P0 Family', code: `P0-${randomUUID().slice(0, 8)}`, equipment_type: 'Vessel' },
      });
      c.familyIds.push(family.id);
      const template = await prisma.workpack_templates.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          template_family_id: family.id,
          name: 'P0 Template',
          equipment_type: 'Vessel',
          job_type: 'Inspection',
          lifecycle_status: 'PUBLISHED',
          discipline_id: anchor.disciplineId,
          created_by: anchor.userId,
          updated_at: new Date(),
        },
      });
      c.templateIds.push(template.id);
      for (const [i, desc] of ['Open', 'Inspect', 'Close'].entries()) {
        await prisma.workpack_template_activities.create({
          data: {
            id: randomUUID(),
            organization_id: anchor.orgId,
            template_id: template.id,
            sequence_number: i + 1,
            description: desc,
            duration_hours: 8,
            updated_at: new Date(),
          },
        });
      }

      const result = await TemplateLibraryService.instantiate({
        templateId: template.id,
        organizationId: anchor.orgId,
        siteId: anchor.siteId,
        userId: anchor.userId,
        event_id: anchor.eventId,
        asset_id: anchor.assetId,
      });
      c.workpackIds.push(result.workpack_id);

      const activities = await prisma.activity.findMany({
        where: { workpack_id: result.workpack_id },
      });
      for (const a of activities) c.activityIds.push(a.id);
      const rels = await prisma.activityRelationship.findMany({
        where: { successor_id: { in: c.activityIds } },
      });
      for (const r of rels) c.relationshipIds.push(r.id);

      expect(activities.length).toBe(3);
      for (const a of activities) {
        expect(a.event_id).toBe(anchor.eventId);
        expect(a.discipline_id).toBe(anchor.disciplineId);
      }
      // A1 deviation (schema fact, not a failure): Activity has NO asset_id
      // column — asset linkage lives on the Workpack. Assert it there.
      const workpack = await prisma.workpack.findUnique({ where: { id: result.workpack_id } });
      expect(workpack?.asset_id).toBe(anchor.assetId);
      expect(workpack?.event_id).toBe(anchor.eventId);

      // A2 — CPM (M11) sees the instantiated activities
      const cpm = await ScheduleOrchestrationService.calculateEventSchedule(anchor.eventId, anchor.orgId);
      const cpmIds = new Set(cpm.activities.map((a: any) => a.id));
      for (const a of activities) expect(cpmIds.has(a.id)).toBe(true);

      // A3 — baseline snapshots them
      const baseline = await ScheduleBaselineService.createBaseline(
        anchor.eventId, anchor.orgId, 'P0 baseline', anchor.userId
      );
      c.baselineIds.push(baseline.id);
      const snapped = await prisma.baselineActivity.findMany({ where: { baseline_id: baseline.id } });
      const snappedIds = new Set(snapped.map((s) => s.activity_id));
      for (const a of activities) expect(snappedIds.has(a.id)).toBe(true);

      // A4 — execution board shows them once the workpack is issued
      await prisma.workpack.update({
        where: { id: result.workpack_id },
        data: { status: 'issued' },
      });
      const board = await FieldExecutionService.getExecutionBoard(anchor.orgId, anchor.eventId);
      const boardIds = new Set(board.map((b: any) => b.id));
      for (const a of activities) expect(boardIds.has(a.id)).toBe(true);
    } finally {
      await c.run();
    }
  }, 120_000);

  it('A1b: instantiation without an Event is refused (no fabricated Event)', async () => {
    await expect(
      TemplateLibraryService.instantiate({
        templateId: randomUUID(),
        organizationId: anchor.orgId,
        siteId: anchor.siteId,
        userId: anchor.userId,
      })
    ).rejects.toThrow();
  });
});

describe('Phase 0 / item 2 — CPM enqueue is Event-keyed (no project_id early return)', () => {
  it('ActivityService.createActivity enqueues by event_id derived from the workpack', async () => {
    const c = createCleanup();
    try {
      const workpack = await prisma.workpack.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          site_id: anchor.siteId,
          title: 'P0 enqueue pack',
          created_by: anchor.userId,
          event_id: anchor.eventId,
          status: 'draft',
        },
      });
      c.workpackIds.push(workpack.id);

      (scheduleRecalculateQueue.add as any).mockClear();
      const activity = await ActivityService.createActivity({
        organization_id: anchor.orgId,
        created_by: anchor.userId,
        description: 'P0 enqueue activity',
        workpack_id: workpack.id,
        event_id: anchor.eventId,
        duration_hours: 4,
      });
      c.activityIds.push(activity.id);

      expect(activity.event_id).toBe(anchor.eventId);
      expect(scheduleRecalculateQueue.add).toHaveBeenCalled();
      const payload = (scheduleRecalculateQueue.add as any).mock.calls.at(-1)[1];
      expect(payload.eventId).toBe(anchor.eventId);
      expect(payload.orgId).toBe(anchor.orgId);
      expect(payload.projectId).toBeUndefined();
    } finally {
      await c.run();
    }
  }, 60_000);
});

describe('Phase 0 / item 6 — readiness gates on material and isolation (live DB)', () => {
  it('A10: critical material shortfall blocks START', async () => {
    const c = createCleanup();
    try {
      const workpack = await prisma.workpack.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          title: 'P0 material pack', created_by: anchor.userId,
          event_id: anchor.eventId, status: 'issued',
        },
      });
      c.workpackIds.push(workpack.id);
      const activity = await prisma.activity.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          workpack_id: workpack.id, event_id: anchor.eventId,
          description: 'Work needing gasket', duration_hours: 8,
        },
      });
      c.activityIds.push(activity.id);
      const line = await prisma.workpack_material_lines.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, workpack_id: workpack.id,
          source_type: 'manual', description: 'Gasket kit',
          quantity_required: 10, quantity_available: 0, quantity_on_order: 0,
          is_critical: true, updated_at: new Date(),
        },
      });
      c.materialLineIds.push(line.id);

      const result = await ExecutionReadinessService.evaluateBulkReadiness(anchor.orgId, [activity.id]);
      expect(result[activity.id].is_ready).toBe(false);
      expect(result[activity.id].blockers.some((b) => /material/i.test(b))).toBe(true);
    } finally {
      await c.run();
    }
  }, 60_000);

  it('A11: unconfirmed safe isolation blocks START; the isolating activity is exempt', async () => {
    const c = createCleanup();
    try {
      const workpack = await prisma.workpack.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          title: 'P0 isolation pack', created_by: anchor.userId,
          event_id: anchor.eventId, status: 'issued',
        },
      });
      c.workpackIds.push(workpack.id);
      const work = await prisma.activity.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          workpack_id: workpack.id, event_id: anchor.eventId,
          description: 'Work under isolation', duration_hours: 8,
        },
      });
      const isolator = await prisma.activity.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          workpack_id: workpack.id, event_id: anchor.eventId,
          description: 'Insert blinds', duration_hours: 2,
        },
      });
      c.activityIds.push(work.id, isolator.id);
      const blind = await prisma.blind.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          workpack_id: workpack.id, blind_number: `P0-${randomUUID().slice(0, 6)}`,
          status: 'pending', safe_isolation_confirmed: false,
          insert_activity_id: isolator.id, updated_at: new Date(),
        },
      });
      c.blindIds.push(blind.id);

      const result = await ExecutionReadinessService.evaluateBulkReadiness(anchor.orgId, [work.id, isolator.id]);
      expect(result[work.id].is_ready).toBe(false);
      expect(result[work.id].blockers.some((b) => /isolation/i.test(b))).toBe(true);
      expect(result[isolator.id].blockers.some((b) => /isolation/i.test(b))).toBe(false);
    } finally {
      await c.run();
    }
  }, 60_000);
});

describe('Phase 0 / item 4 — no fabricated S-curve (A13)', () => {
  it('metrics route emits no extrapolated actual series; planned traces to stored dates', async () => {
    const c = createCleanup();
    try {
      const project = await prisma.project.create({
        data: {
          id: randomUUID(), org_id: anchor.orgId, name: 'P0 metrics',
          code: `P0M-${randomUUID().slice(0, 6)}`, updated_at: new Date(),
        },
      });
      c.projectIds.push(project.id);
      const workpack = await prisma.workpack.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          title: 'P0 metrics pack', created_by: anchor.userId,
          project_id: project.id, event_id: null, status: 'draft',
        },
      });
      c.workpackIds.push(workpack.id);
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const activity = await prisma.activity.create({
        data: {
          id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
          workpack_id: workpack.id, event_id: null,
          description: 'Metrics activity', duration_hours: 16,
          planned_start: start, planned_end: end, progress_percent: 25,
        },
      });
      c.activityIds.push(activity.id);

      const res = await metricsGET(
        new Request('http://test') as any,
        { params: Promise.resolve({ id: project.id }) } as any
      );
      const body = await res.json();

      expect(Array.isArray(body.curveData)).toBe(true);
      expect(body.curveData.length).toBeGreaterThan(0);
      // A13 — every actual point is null: no stored per-day actuals, no extrapolation.
      for (const point of body.curveData) {
        expect(point.actual).toBeNull();
        expect(typeof point.planned).toBe('number');
      }
      // Planned series traces to the stored planned_start/planned_end window.
      const first = body.curveData[0];
      const last = body.curveData[body.curveData.length - 1];
      expect(last.planned).toBeGreaterThan(first.planned);
      expect(last.planned).toBe(100);
    } finally {
      await c.run();
    }
  }, 60_000);
});

describe('Phase 0 / item 5 — legacy /projects chain quarantined', () => {
  it('LEGACY_PROJECT_CHAIN flag defaults to disabled (no flag row seeded)', async () => {
    const flag = await prisma.featureFlag.findUnique({ where: { key: LEGACY_PROJECT_CHAIN_FLAG } });
    expect(flag).toBeNull();
    await expect(isLegacyProjectChainEnabled(anchor.orgId)).resolves.toBe(false);
  });

  it('legacy punch register API returns 410 when the flag is off', async () => {
    const res = await punchGET(
      new Request('http://test') as any,
      { params: Promise.resolve({ id: randomUUID() }) } as any
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe('LEGACY_PROJECT_CHAIN_RETIRED');
  });

  it('Project overview no longer wires the retired s-curve / AI assistant chain', () => {
    const src = readFileSync('app/(dashboard)/projects/[id]/ProjectDetailClient.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    expect(src).not.toMatch(/s-curve/);
    expect(src).not.toMatch(/AIAssistantPanel/);
    expect(src).not.toMatch(/SCurveChart/);
  });

  it('the /punch signpost no longer links into the Project domain', () => {
    const src = readFileSync('app/(dashboard)/punch/page.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    expect(src).not.toMatch(/href="\/projects"/);
    expect(src).toMatch(/\/workpacks/);
  });
});

describe('Phase 0 / item 3 — worker deployment wiring', () => {
  it('base and prod compose both run the BullMQ worker process', () => {
    const base = readFileSync('docker-compose.yml', 'utf8');
    const prod = readFileSync('docker-compose.prod.yml', 'utf8');
    for (const [name, text] of [['base', base], ['prod', prod]] as const) {
      expect(text, name).toMatch(/worker:/);
      expect(text, name).toMatch(/src\/workers\/index\.ts/);
    }
  });
});

describe('Phase 0 / menu — M13 / M14 / M15 visible in the tenant shell', () => {
  const FULL_CTX: NavGateContext = {
    role: 'tenant_administrator',
    isFeat: () => true,
    isContractorTenant: false,
    showAdmin: true,
    canViewOrgSettings: true,
  };

  it('tenant shell navigation is driven by TENANT_SHELL_SECTIONS order and labels', () => {
    const shell = buildTenantShellNavigation(FULL_CTX);
    expect(shell.map((s) => s.id)).toEqual(TENANT_SHELL_SECTIONS.map((s) => s.id));
    expect(shell.map((s) => s.label)).toEqual(TENANT_SHELL_SECTIONS.map((s) => s.label));
    expect(existsSync('app/(dashboard)/layout.tsx')).toBe(true);
    const layoutSrc = readFileSync('app/(dashboard)/layout.tsx', 'utf8');
    expect(layoutSrc).toContain('buildTenantShellNavigation');
    expect(layoutSrc).toContain('tenantShellSections');
  });

  it('STO menu contains Control Tower (M13), Management Intelligence (M15) and M14 reporting', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(nav.sto.some((i) => i.href === '/control-tower')).toBe(true);
    expect(nav.sto.some((i) => i.href === '/management-intelligence')).toBe(true);
    expect(nav.sto.some((i) => i.href === '/reporting')).toBe(true);
    expect(nav.sto.some((i) => i.href === '/reports')).toBe(true);
    // They are STO-owned, not a domain-neutral Intelligence top-level group.
    expect(nav.project.some((i) => i.href === '/control-tower')).toBe(false);
    expect(Object.keys(nav)).toEqual(['digital-plant', 'sto', 'project', 'organization']);
  });

  it('landing pages exist that resolve the active Event', () => {
    expect(existsSync('app/(dashboard)/control-tower/page.tsx')).toBe(true);
    expect(existsSync('app/(dashboard)/management-intelligence/page.tsx')).toBe(true);
    const ct = readFileSync('app/(dashboard)/control-tower/page.tsx', 'utf8');
    expect(ct).toContain('/control-tower');
    expect(ct).toContain('activeEventId');
  });
});
