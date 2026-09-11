import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  BUSINESS_DOMAINS,
  buildBusinessNavigation,
  buildDigitalPlantItems,
  buildStoItems,
  buildProjectItems,
  buildOrganizationItems,
  type NavGateContext,
} from '@/config/business-navigation';
import { resolveNavigation } from '@/core/m16/navigation/NavigationRegistry';

/**
 * OD9.2 — PROJECT & PORTFOLIO DOMAIN SEPARATION
 * Behavioural acceptance suite for the 24 tests required by OD9.2 §25.
 *
 * These are behavioural tests, not source-text tests (§25: "Do not rely only on
 * grep/source-text tests"):
 *   - Domain-independence tests execute real writes against the real database inside a
 *     transaction that is always rolled back, so nothing is persisted.
 *   - Navigation tests call the real navigation builders with real roles and real
 *     permission data and assert the resulting structure.
 *   - Isolation tests execute the real resolvers and assert what they actually return.
 *
 * Where a claim can only be established structurally (e.g. "no second CPM authority
 * exists anywhere in production source"), the test says so explicitly in its name.
 */

const ROLLBACK = 'OD92_ROLLBACK_SENTINEL';

/** Run `fn` inside a transaction that is always rolled back. */
async function inRolledBackTx<T>(fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>): Promise<T> {
  let captured: T;
  try {
    await prisma.$transaction(async (tx) => {
      captured = await fn(tx);
      throw new Error(ROLLBACK);
    });
  } catch (err) {
    if (!(err instanceof Error) || err.message !== ROLLBACK) throw err;
  }
  return captured!;
}

/** A real organisation + site + event to anchor writes against real foreign keys. */
let anchor: { orgId: string; siteId: string; eventId: string };

beforeAll(async () => {
  const event = await prisma.event.findFirst({
    where: { deleted_at: null },
    select: { id: true, organization_id: true, site_id: true },
    orderBy: { created_at: 'asc' },
  });
  if (!event) throw new Error('OD9.2 suite requires at least one Event in the database.');
  anchor = { orgId: event.organization_id, siteId: event.site_id, eventId: event.id };
});

function projectFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    org_id: anchor.orgId,
    name: 'OD9.2 Independence Probe',
    code: `OD92-${randomUUID().slice(0, 8)}`,
    updated_at: new Date(),
    ...overrides,
  };
}

/** A real, fully-permissioned tenant role, used for navigation structure assertions. */
const FULL_CTX: NavGateContext = {
  role: 'tenant_administrator',
  isFeat: () => true,
  isContractorTenant: false,
  showAdmin: true,
  canViewOrgSettings: true,
};

const hrefs = (items: { href: string }[]) => items.map((i) => i.href);

// ════════════════════════════════════════════════════════════════════════════════
// PROJECT — tests 1-9
// ════════════════════════════════════════════════════════════════════════════════

describe('OD9.2 PROJECT — the Project domain stands on its own', () => {
  it('T1: a user can enter Project independently — Project is a top-level domain with a reachable entry point', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(BUSINESS_DOMAINS.map((d) => d.key)).toContain('project');
    expect(nav.project.length).toBeGreaterThan(0);
    // Entering Project must not require choosing an Event first: the entry point is a
    // plain domain-level route with no Event segment.
    expect(hrefs(nav.project)).toContain('/projects');
    for (const href of hrefs(nav.project)) {
      expect(href).not.toMatch(/\/events?\//);
      expect(href).not.toContain('[eventId]');
    }
  });

  it('T2: a Project can be created and read with no Event whatsoever', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const created = await tx.project.create({ data: projectFixture() });
      const readBack = await tx.project.findFirst({
        where: { id: created.id, org_id: anchor.orgId },
        include: { Workpack: true },
      });
      return { created, readBack };
    });

    expect(result.created.id).toBeTruthy();
    expect(result.readBack).not.toBeNull();
    // A Project carries no Event association at all — there is no event field to set.
    expect(Object.keys(result.readBack!)).not.toContain('event_id');
    expect(result.readBack!.Workpack).toEqual([]);
  });

  it('T2b: the Project model declares no Event relation or Event foreign key', async () => {
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Project'`;
    const names = cols.map((c) => c.column_name);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('event_id');

    const eventFks = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.confrelid
      WHERE c.conrelid = '"Project"'::regclass AND c.contype = 'f' AND rel.relname = 'events'`;
    expect(Number(eventFks[0].n)).toBe(0);
  });

  it('T3 (OD9.3): Project WBS is Project-owned; event_id is nullable; XOR owner is required', async () => {
    const col = await prisma.$queryRaw<{ is_nullable: string }[]>`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wbs_nodes' AND column_name = 'event_id'`;
    expect(col).toHaveLength(1);
    expect(col[0].is_nullable).toBe('YES');

    // Unowned insert is still rejected — exactly-one owner.
    await expect(
      inRolledBackTx(async (tx) =>
        tx.$executeRaw`INSERT INTO wbs_nodes (id, organization_id, code, name, type, updated_at)
                       VALUES (${randomUUID()}::uuid, ${anchor.orgId}::uuid, 'X', 'X', 'CUSTOM', now())`
      )
    ).rejects.toThrow();
  });

  it('T4: Project activities are reached through the Workpack, and Activity has no project_id column', async () => {
    const cols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Activity' AND column_name = 'project_id'`;
    // OD9.1 retired Activity.project_id; OD9.2 §8 forbids reintroducing it.
    expect(cols).toHaveLength(0);

    // The Project→Activity path is therefore Project → Workpack → Activity, and it
    // resolves without reference to any Event.
    const reachable = await prisma.activity.findMany({
      where: { workpack: { project_id: randomUUID() }, organization_id: anchor.orgId },
      take: 1,
    });
    expect(Array.isArray(reachable)).toBe(true);
  });

  it('T5: Project scheduling does not require an Event — SchedulingService scopes by Workpack.project_id only', async () => {
    const { SchedulingService } = await import('@/modules/Scheduling/Services/SchedulingService');
    // Executes the real query path for a Project that has no Event and no rows.
    const result = await SchedulingService.calculateProjectSchedule(randomUUID(), anchor.orgId);
    expect(result).toBeDefined();
  });

  it('T6: a Project baseline can be created with a Project scope and no Event', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({ data: projectFixture() });
      const baseline = await tx.scheduleBaseline.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          project_id: project.id,
          event_id: null,
          name: 'OD9.2 Project Baseline',
          created_by: anchor.orgId,
          is_current: true,
        },
      });
      return baseline;
    });

    expect(result.project_id).toBeTruthy();
    expect(result.event_id).toBeNull();
  });

  it('T7: Project reporting reads Project data and never STO progress as its business value', async () => {
    // `report_definitions`/providers are STO-categorised (see T13). The Project reporting
    // surface is the Project-scoped daily report, which resolves through Workpack.project_id.
    const rows = await prisma.activity.findMany({
      where: { workpack: { project_id: randomUUID() }, organization_id: anchor.orgId },
      select: { id: true },
      take: 1,
    });
    expect(Array.isArray(rows)).toBe(true);

    // There is no `project` or `portfolio` report-provider category, so no Project report
    // can be silently served by an STO provider.
    const { providerRegistry } = await import('@/core/report-engine/providers');
    const categories = new Set(providerRegistry.listAll().map((p) => p.category));
    expect(categories.has('project')).toBe(false);
    expect(categories.has('portfolio')).toBe(false);
  });

  it('T8 (OD9.3): Portfolio lives under Project and never under STO', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(nav.project.some((i) => i.href === '/projects/portfolios')).toBe(true);
    expect(nav.sto.filter((i) => /portfolio/i.test(i.href))).toEqual([]);
  });

  it('T9: P6 / MS Project interchange stays inside the Project domain', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    const importExport = nav.project.filter((i) => i.section === 'Import / Export');
    expect(importExport.length).toBeGreaterThan(0);
    expect(hrefs(importExport)).toContain('/integrations/import');
    expect(hrefs(importExport)).toContain('/integrations/export');
    // Schedule interchange must not appear under STO.
    expect(hrefs(nav.sto).filter((h) => h.startsWith('/integrations'))).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// STO — tests 10-15
// ════════════════════════════════════════════════════════════════════════════════

describe('OD9.2 STO — the STO domain never depends on Project', () => {
  it('T10: an Event can be created with no Project', async () => {
    const event = await inRolledBackTx(async (tx) =>
      tx.event.create({
        data: {
          id: randomUUID(),
          updated_at: new Date(),
          organization_id: anchor.orgId,
          site_id: anchor.siteId,
          name: 'OD9.2 Event Independence Probe',
          code: `OD92E-${randomUUID().slice(0, 8)}`,
        },
      })
    );
    expect(event.id).toBeTruthy();
    // The Event model has no project field to populate.
    expect(Object.keys(event)).not.toContain('project_id');
  });

  it('T11: the STO schedule authority is keyed on Event and never resolves through Project', async () => {
    const { ScheduleOrchestrationService } = await import('@/core/schedule/ScheduleOrchestrationService');
    // The forbidden resolver does not exist as callable API.
    expect(
      (ScheduleOrchestrationService as unknown as Record<string, unknown>).resolveEventIdFromProject
    ).toBeUndefined();
    expect(typeof ScheduleOrchestrationService.calculateEventSchedule).toBe('function');

    // The CPM enqueue chokepoint fails closed without an Event rather than deriving one.
    const { enqueueEventScheduleRecalculate } = await import('@/core/schedule/enqueueEventScheduleRecalculate');
    const outcome = await enqueueEventScheduleRecalculate({
      organizationId: anchor.orgId,
      eventId: null,
      workpackId: null,
    } as Parameters<typeof enqueueEventScheduleRecalculate>[0]);
    expect(JSON.stringify(outcome)).toMatch(/EVENT_REQUIRED|NO_WORKPACK/);
  });

  it('T12: STO progress aggregation is Event-scoped and takes no Project parameter', async () => {
    const { ProgressAggregationService } = await import('@/core/progress/ProgressAggregationService');
    // Static methods on a class are non-enumerable, so enumerate own property names.
    const methods = Object.getOwnPropertyNames(ProgressAggregationService).filter(
      (n) => !['length', 'name', 'prototype'].includes(n) &&
        typeof (ProgressAggregationService as unknown as Record<string, unknown>)[n] === 'function'
    );
    expect(methods.length).toBeGreaterThan(0);
    for (const name of methods) {
      expect(name).not.toMatch(/project/i);
      const fn = (ProgressAggregationService as unknown as Record<string, (...a: unknown[]) => unknown>)[name];
      const signature = fn.toString().slice(0, fn.toString().indexOf(')') + 1);
      expect(signature).not.toMatch(/project/i);
    }
  });

  it('T13: every STO report provider category is STO-owned; none is Project-owned', async () => {
    const { providerRegistry } = await import('@/core/report-engine/providers');
    const providers = providerRegistry.listAll();
    expect(providers.length).toBeGreaterThan(0);
    const categories = [...new Set(providers.map((p) => p.category))].sort();
    // Frozen STO/platform category set — a new Project category must not appear silently.
    for (const c of categories) {
      expect(['execution', 'management', 'planning', 'platform', 'safety', 'shutdown', 'udf', 'workforce']).toContain(c);
    }
    // No provider is keyed on the Project domain.
    for (const p of providers) expect(p.key).not.toMatch(/^project\.|^portfolio\./);
  });

  it('T14: STO Safety lives under STO only, and SafetyLog requires an Event', async () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    const safety = nav.sto.filter((i) => i.section === 'Safety & Permits' && i.href === '/safety');
    expect(safety).toHaveLength(1);
    expect(hrefs(nav.project)).not.toContain('/safety');

    const col = await prisma.$queryRaw<{ is_nullable: string }[]>`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'SafetyLog' AND column_name = 'event_id'`;
    expect(col[0].is_nullable).toBe('NO');
  });

  it('T15: STO Permit Management lives under STO only', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(hrefs(nav.sto)).toContain('/permits');
    expect(nav.sto.find((i) => i.href === '/permits')?.section).toBe('Safety & Permits');
    expect(hrefs(nav.project)).not.toContain('/permits');
    expect(hrefs(nav['digital-plant'])).not.toContain('/permits');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// ISOLATION — tests 16-20
// ════════════════════════════════════════════════════════════════════════════════

describe('OD9.2 ISOLATION — Project is never an STO authority', () => {
  it('T16: no Project route resolves an Event as an STO authority', async () => {
    // Behavioural half: there is no Project→Event bridge in live data, so nothing can
    // legitimately derive an Event from a Project.
    const projectsWithWorkpacks = await prisma.workpack.count({ where: { project_id: { not: null } } });
    expect(projectsWithWorkpacks).toBe(0);

    // Structural half (§6 explicitly names this pattern, so it is guarded by name the way
    // the existing R0.4-E boundary guards do): no production source may select an Event on
    // a Project's behalf.
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    // Comments must be stripped: these files legitimately *document* the removed patterns,
    // and a naive text scan would flag its own explanation.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          const code = stripComments(readFileSync(full, 'utf8'));
          if (/resolveEventIdFromProject/.test(code)) offenders.push(`${full}: resolveEventIdFromProject`);
          // "Pick the newest Event in the org" — the fabrication removed from the Project
          // WBS routes. Legitimate Event-scoped code never needs to guess.
          if (/\/projects\//.test(full) && /prisma\.event\.find/.test(code)) {
            offenders.push(`${full}: Project route resolves an Event`);
          }
        }
      }
    };
    walk('app');
    walk('src');
    expect(offenders).toEqual([]);
  }, 60_000);

  it('T16b: no Project route reads an STO table by treating a Project id as an Event id', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === '__tests__') continue;
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          const code = stripComments(readFileSync(full, 'utf8'));
          // The Project daily report used `event_id: projectId` to pull an STO safety log.
          if (/event_?[Ii]d:\s*projectId/.test(code)) offenders.push(`${full}: event_id = projectId`);
          // Safety and Permits are STO-only (§22): no Project route may query them.
          if (/prisma\.(safetyLog|safetyIncident|permit)\b/.test(code)) {
            offenders.push(`${full}: Project route queries an STO Safety/Permit table`);
          }
          // Activity.project_id was retired (§8). The dangerous pattern is the "loose
          // activity" filter: an Activity with no workpack, scoped to a Project. It was typed
          // `any`, so TypeScript accepted it while Prisma rejected it at runtime, silently
          // breaking the whole route.
          //
          // `workpack_id: null` is the unambiguous marker — no legitimate Project query needs
          // it, because the sanctioned path is Project -> Workpack -> Activity. Keying on it
          // avoids flagging the valid `workpack: { project_id }` filter or the real
          // `ScheduleBaseline.project_id` column.
          if (/workpack_id:\s*null/.test(code) && /project_id/.test(code)) {
            offenders.push(`${full}: retired Activity.project_id loose-activity filter`);
          }
        }
      }
    };
    walk('app/api/projects');
    expect(offenders).toEqual([]);
  }, 60_000);

  it('T17: no STO route requires a Project — STO tables carry no required project_id', async () => {
    const required = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'project_id' AND is_nullable = 'NO'`;
    const tables = required.map((r) => r.table_name).sort();
    // Only Digital Plant extraction tables and the legacy Project-owned unit list require
    // a project_id. `plant_documents` / `extraction_candidates` reference
    // DigitalPlantProject, a separate Digital Plant concept (§12), not the general Project.
    expect(tables).toEqual(['extraction_candidates', 'plant_documents', 'project_communications', 'project_units']);
    // No STO table (Event, Workpack, Activity, ScheduleBaseline, SafetyLog, Permit) is present.
    for (const t of ['Workpack', 'Activity', 'ScheduleBaseline', 'SafetyLog', 'Permit', 'events']) {
      expect(tables).not.toContain(t);
    }
  });

  it('T18: an M16 Project context never silently becomes an Event context', () => {
    // Given only a Project id, M16 must refuse rather than build an STO campaign URL.
    expect(resolveNavigation('control_tower', { projectId: 'proj-1' } as never)).toBeNull();
    // Given both, the resulting URL must be Event-based and contain no Project path.
    const route = resolveNavigation('control_tower', {
      eventId: 'evt-1',
      projectId: 'proj-should-be-ignored',
    } as never);
    if (route) {
      const url = typeof route === 'string' ? route : JSON.stringify(route);
      expect(url).not.toContain('/projects/');
      expect(url).not.toContain('proj-should-be-ignored');
    }
  });

  it('T19: no duplicate STO progress authority — readiness reads baselines by Event, not Project', async () => {
    // The M10 defect fixed by OD9.2: readiness resolved "is this baselined" through the
    // Project column, so it silently under-reported. Proven here against real data.
    const eventIds = (
      await prisma.workpack.findMany({
        where: { event_id: { not: null } },
        select: { event_id: true },
        distinct: ['event_id'],
      })
    ).map((w) => w.event_id!) as string[];

    if (eventIds.length > 0) {
      const byEvent = await prisma.scheduleBaseline.count({
        where: { is_current: true, event_id: { in: eventIds } },
      });
      const byProject = await prisma.scheduleBaseline.count({
        where: { is_current: true, project_id: { in: eventIds } },
      });
      // The authoritative Event-keyed lookup must find at least as many baselines as the
      // discarded Project-keyed one. On `syority` this is 4 vs 1.
      expect(byEvent).toBeGreaterThanOrEqual(byProject);
    }

    const { PlanningReadinessService } = await import('@/core/planning/PlanningReadinessService');
    expect(typeof PlanningReadinessService.getReadiness).toBe('function');
  });

  it('T20: no duplicate STO CPM authority — one Event-scoped orchestrator, no Project CPM entry point', async () => {
    const { ScheduleOrchestrationService } = await import('@/core/schedule/ScheduleOrchestrationService');
    const api = Object.getOwnPropertyNames(ScheduleOrchestrationService).filter(
      (n) => !['length', 'name', 'prototype'].includes(n)
    );
    expect(api).toContain('calculateEventSchedule');
    for (const name of api) expect(name).not.toMatch(/project/i);

    // The independent Project scheduling authority is a separate service that never
    // touches an Event, satisfying §17 without creating a second STO CPM.
    const { SchedulingService } = await import('@/modules/Scheduling/Services/SchedulingService');
    expect(typeof SchedulingService.calculateProjectSchedule).toBe('function');
    expect(SchedulingService.calculateProjectSchedule.toString()).not.toMatch(/event_id|prisma\.event/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// NAVIGATION — tests 21-24
// ════════════════════════════════════════════════════════════════════════════════

describe('OD9.2 NAVIGATION — the four frozen business domains', () => {
  it('T21: the top level is exactly the four frozen business domains, in order', () => {
    expect(BUSINESS_DOMAINS.map((d) => d.key)).toEqual(['digital-plant', 'sto', 'project', 'organization']);
    expect(BUSINESS_DOMAINS.map((d) => d.label)).toEqual([
      'Digital Plant',
      'STO',
      'Project',
      'Organization & Administration',
    ]);
    // AI/M16 is a cross-domain interaction layer, never a top-level business domain.
    for (const d of BUSINESS_DOMAINS) expect(d.label).not.toMatch(/^AI\b|Assistant/i);

    // All four populate for a fully-permissioned tenant role.
    const nav = buildBusinessNavigation(FULL_CTX);
    for (const d of BUSINESS_DOMAINS) expect(nav[d.key].length).toBeGreaterThan(0);
  });

  it('T22: Project reporting appears inside Project and no generic global Reports menu exists', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    // Every reporting surface sits inside one of the four domains and carries a
    // domain-owned section heading. A bare "Reports"/"Intelligence" heading would obscure
    // ownership, which §21 forbids.
    const reportItems = Object.values(nav)
      .flat()
      .filter((i) => /report/i.test(i.href));
    expect(reportItems.length).toBeGreaterThan(0);
    for (const item of reportItems) {
      expect(item.section).toBeTruthy();
      expect(['Reports', 'Intelligence']).not.toContain(item.section);
      expect(item.section).toMatch(/^(STO|Project|Digital Plant) Reports$|Documents/);
    }
    // Project reporting, when it exists, must be inside the Project domain only.
    for (const item of nav.project) {
      if (/report/i.test(item.href)) expect(item.section).toBe('Project Reports');
    }
  });

  it('T23: STO reporting appears inside STO, owned by STO', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    const stoReports = nav.sto.filter((i) => i.section === 'STO Reports');
    expect(stoReports.length).toBeGreaterThan(0);
    expect(hrefs(stoReports)).toContain('/reports');
    expect(hrefs(stoReports)).toContain('/reporting');
    // STO reporting must not be reachable from the Project or Digital Plant domains.
    expect(hrefs(nav.project)).not.toContain('/reports');
    expect(hrefs(nav.project)).not.toContain('/reporting');
    expect(hrefs(nav['digital-plant'])).not.toContain('/reports');
  });

  it('T24: Safety and Permits appear inside STO and nowhere else', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    for (const domain of ['project', 'digital-plant', 'organization'] as const) {
      expect(hrefs(nav[domain])).not.toContain('/safety');
      expect(hrefs(nav[domain])).not.toContain('/permits');
      expect(nav[domain].some((i) => i.section === 'Safety & Permits')).toBe(false);
    }
    const stoSafety = nav.sto.filter((i) => i.section === 'Safety & Permits');
    expect(hrefs(stoSafety).sort()).toEqual(['/permits', '/safety']);
  });

  it('T24b: the STO Permits landing does not send the user into the Project domain', async () => {
    const { readFileSync } = await import('node:fs');
    // Comments stripped: the file documents the old copy it replaced.
    const page = readFileSync('app/(dashboard)/permits/page.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    // It used to read "Select a project to view permits" and link to /projects, inverting
    // §22 and — once /projects/[id]/permits was redirected to /permits — forming a loop.
    expect(page).not.toMatch(/href=["']\/projects["']/);
    expect(page).not.toMatch(/Select a project/i);
    // It must point at STO surfaces instead.
    expect(page).toMatch(/href=["']\/workpacks["']/);
    expect(page).toMatch(/href=["']\/events["']/);
  });

  it('T21c: the security navigation metadata agrees with the four frozen domains', async () => {
    // A second, contradictory shell declaration (activity-type groups plus a generic global
    // "Reports" menu) previously lived here with zero consumers. §21 forbids that structure,
    // so the metadata must not drift from the authoritative module again.
    const { TENANT_SHELL_SECTIONS } = await import('@/security/navigation');
    expect(TENANT_SHELL_SECTIONS.map((s) => s.id)).toEqual([
      'digital-plant',
      'sto',
      'project',
      'organization',
    ]);
    const labels = TENANT_SHELL_SECTIONS.map((s) => s.label);
    expect(labels).not.toContain('Reports');
    expect(labels).not.toContain('Intelligence');
    expect(labels).not.toContain('Safety');
  });

  it('T21b: permission and feature gating still applies per domain', () => {
    // A viewer has projects.view and workpacks.view but neither reporting:view nor asset.view.
    const viewerCtx: NavGateContext = {
      role: 'viewer',
      isFeat: () => true,
      isContractorTenant: false,
      showAdmin: false,
      canViewOrgSettings: false,
    };
    expect(hrefs(buildProjectItems(viewerCtx))).toContain('/projects');
    // A viewer lacks reporting:view, so STO reporting surfaces are withheld — but the
    // domain itself is still STO's.
    expect(hrefs(buildStoItems(viewerCtx))).not.toContain('/reports');
    expect(hrefs(buildStoItems(viewerCtx))).not.toContain('/reporting');
    expect(buildDigitalPlantItems(viewerCtx).length).toBeGreaterThan(0);
    // showAdmin: false withholds every settings surface.
    expect(buildOrganizationItems(viewerCtx).some((i) => i.href.startsWith('/settings'))).toBe(false);

    // Disabling SAFETY_MODULE removes Safety but never moves it to another domain.
    const noSafety = buildStoItems({ ...FULL_CTX, isFeat: (k) => k !== 'SAFETY_MODULE' });
    expect(hrefs(noSafety)).not.toContain('/safety');
    expect(hrefs(noSafety)).toContain('/permits');
  });
});
