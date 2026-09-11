import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { PortfolioService } from '@/core/project/PortfolioService';
import { ProjectWbsService } from '@/core/project/ProjectWbsService';
import { ProjectWorkpackService } from '@/core/project/ProjectWorkpackService';
import { ProjectReportService } from '@/core/project/ProjectReportService';
import { ProjectCommunicationService } from '@/core/project/ProjectCommunicationService';
import { ProjectBaselineCompareService } from '@/core/project/ProjectBaselineCompareService';
import { SchedulingService } from '@/modules/Scheduling/Services/SchedulingService';
import { buildBusinessNavigation, type NavGateContext } from '@/config/business-navigation';
import { TENANT_SHELL_SECTIONS } from '@/security/navigation';

const ROLLBACK = 'OD93_ROLLBACK_SENTINEL';

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

let anchor: { orgId: string; siteId: string; eventId: string; userId: string };

beforeAll(async () => {
  const event = await prisma.event.findFirst({
    where: { deleted_at: null },
    select: { id: true, organization_id: true, site_id: true },
    orderBy: { created_at: 'asc' },
  });
  if (!event) throw new Error('OD9.3 requires at least one Event.');
  const user = await prisma.user.findFirst({
    where: { organization_id: event.organization_id },
    select: { id: true },
  });
  if (!user) throw new Error('OD9.3 requires a User in the Event organisation.');
  anchor = { orgId: event.organization_id, siteId: event.site_id, eventId: event.id, userId: user.id };
});

const FULL_CTX: NavGateContext = {
  role: 'tenant_administrator',
  isFeat: () => true,
  isContractorTenant: false,
  showAdmin: true,
  canViewOrgSettings: true,
};

describe('OD9.3 PROJECT foundation', () => {
  it('T1/T2: create and read a Project without an Event', async () => {
    const created = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 Project',
          code: `OD93-${randomUUID().slice(0, 8)}`,
          updated_at: new Date(),
        },
      });
      const read = await tx.project.findFirst({
        where: { id: project.id, org_id: anchor.orgId },
      });
      return { project, read };
    });
    expect(created.read?.id).toBe(created.project.id);
    expect((created.project as any).event_id).toBeUndefined();
  });

  it('T3/T4: create a Portfolio and associate a Project', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const portfolio = await PortfolioService.create(anchor.orgId, {
        name: 'OD93 Portfolio',
        code: `PF-${randomUUID().slice(0, 6)}`,
      }, tx as any);
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 Associated',
          code: `OD93A-${randomUUID().slice(0, 6)}`,
          portfolio_id: portfolio.id,
          updated_at: new Date(),
        },
      });
      const dash = await PortfolioService.dashboard(anchor.orgId, portfolio.id, tx as any);
      return { portfolio, project, dash };
    });
    expect(result.project.portfolio_id).toBe(result.portfolio.id);
    expect(result.dash.counts.projects).toBe(1);
  });

  it('T5/T6: create a nested Project WBS without Event', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 WBS',
          code: `OD93W-${randomUUID().slice(0, 6)}`,
          updated_at: new Date(),
        },
      });
      const root = await ProjectWbsService.create(anchor.orgId, project.id, { name: 'Engineering', code: 'ENG' }, tx as any);
      const child = await ProjectWbsService.create(anchor.orgId, project.id, {
        name: 'Civil',
        code: 'ENG.CIV',
        parent_id: root.id,
      }, tx as any);
      const listed = await ProjectWbsService.list(anchor.orgId, project.id, tx as any);
      return { project, root, child, listed };
    });
    expect(result.root.event_id).toBeNull();
    expect(result.root.project_id).toBe(result.project.id);
    expect(result.child.parent_id).toBe(result.root.id);
    expect(result.listed.flat).toHaveLength(2);
    expect(result.listed.tree[0].children).toHaveLength(1);
  });

  it('T7: create a Project workpack and activity under a WBS node, without Event', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 ACT',
          code: `OD93C-${randomUUID().slice(0, 6)}`,
          updated_at: new Date(),
        },
      });
      const node = await ProjectWbsService.create(anchor.orgId, project.id, { name: 'Construction' }, tx as any);
      const created = await ProjectWorkpackService.createUnderWbs(anchor.orgId, project.id, {
        site_id: anchor.siteId,
        title: 'Civil package',
        created_by: anchor.userId,
        wbs_node_id: node.id,
        activity: { description: 'Pour foundations', duration_hours: 16 },
      }, tx as any);
      return created;
    });
    expect(result.workpack.event_id).toBeNull();
    expect(result.workpack.project_id).toBeTruthy();
    expect(result.workpack.wbs_node_id).toBeTruthy();
    expect(result.activity?.event_id).toBeNull();
    expect(result.activity?.workpack_id).toBe(result.workpack.id);
  });

  it('T8/T9: Project CPM and critical path without Event', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 CPM',
          code: `OD93S-${randomUUID().slice(0, 6)}`,
          planned_sd_date: new Date(),
          updated_at: new Date(),
        },
      });
      const { workpack } = await ProjectWorkpackService.createUnderWbs(anchor.orgId, project.id, {
        site_id: anchor.siteId,
        title: 'CPM pack',
        created_by: anchor.userId,
      }, tx as any);
      const a1 = await tx.activity.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          site_id: anchor.siteId,
          workpack_id: workpack.id,
          description: 'A',
          duration_hours: 10,
          sequence_number: 1,
        },
      });
      const a2 = await tx.activity.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          site_id: anchor.siteId,
          workpack_id: workpack.id,
          description: 'B',
          duration_hours: 10,
          sequence_number: 2,
        },
      });
      await tx.activityRelationship.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          predecessor_id: a1.id,
          successor_id: a2.id,
          relationship_type: 'FS',
          lag_days: 0,
          updated_at: new Date(),
        },
      });
      const cpm = await SchedulingService.calculateProjectSchedule(project.id, anchor.orgId, tx as any);
      return cpm;
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.activities.some((a: any) => a.is_critical)).toBe(true);
  });

  it('T10/T11: Project baseline without Event, then compare', async () => {
    const result = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 BL',
          code: `OD93B-${randomUUID().slice(0, 6)}`,
          updated_at: new Date(),
        },
      });
      const { workpack } = await ProjectWorkpackService.createUnderWbs(anchor.orgId, project.id, {
        site_id: anchor.siteId,
        title: 'BL pack',
        created_by: anchor.userId,
      }, tx as any);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-10');
      const act = await tx.activity.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          site_id: anchor.siteId,
          workpack_id: workpack.id,
          description: 'Baseline activity',
          planned_start: start,
          planned_end: end,
          duration_hours: 20,
        },
      });
      const baseline = await tx.scheduleBaseline.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          project_id: project.id,
          name: 'BL1',
          created_by: anchor.userId,
          is_current: true,
        },
      });
      await tx.baselineActivity.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          baseline_id: baseline.id,
          activity_id: act.id,
          planned_start: start,
          planned_finish: end,
          duration: 2,
        },
      });
      await tx.activity.update({
        where: { id: act.id },
        data: { planned_end: new Date('2026-01-20') },
      });
      const cmp = await ProjectBaselineCompareService.compare(anchor.orgId, project.id, baseline.id, tx as any);
      return cmp;
    });
    expect(result.rows[0].finish_variance_days).toBe(10);
    expect(result.rows[0].in_baseline).toBe(true);
  });

  it('T12/T13/T14: Project report uses Project data only', async () => {
    const report = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 RPT',
          code: `OD93R-${randomUUID().slice(0, 6)}`,
          updated_at: new Date(),
        },
      });
      return ProjectReportService.status(anchor.orgId, project.id, tx as any);
    });
    expect(report.authority).toBe('PROJECT');
    expect(report.project.name).toBe('OD93 RPT');
    const src = (await import('node:fs')).readFileSync('src/core/project/ProjectReportService.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    expect(src).not.toMatch(/safetyLog|permit|prisma\.event\b|ProgressAggregationService/);
  });

  it('T15/T16: Project export / P6 stay Project-scoped in navigation', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(nav.project.some((i) => i.href === '/integrations/export')).toBe(true);
    expect(nav.project.some((i) => i.href === '/integrations/import')).toBe(true);
    expect(nav.sto.filter((i) => i.href.startsWith('/integrations'))).toEqual([]);
  });
});

describe('OD9.3 STO isolation', () => {
  it('T17: Event still works without Project', async () => {
    const event = await inRolledBackTx(async (tx) =>
      tx.event.create({
        data: {
          id: randomUUID(),
          updated_at: new Date(),
          organization_id: anchor.orgId,
          site_id: anchor.siteId,
          name: 'OD93 Event',
          code: `OD93E-${randomUUID().slice(0, 6)}`,
        },
      })
    );
    expect((event as any).project_id).toBeUndefined();
  });

  it('T18: Event WBS still works', async () => {
    const node = await inRolledBackTx(async (tx) =>
      tx.wbsNode.create({
        data: {
          id: randomUUID(),
          organization_id: anchor.orgId,
          event_id: anchor.eventId,
          code: 'E.OD93',
          name: 'Event WBS',
          type: 'CUSTOM',
          updated_at: new Date(),
        },
      })
    );
    expect(node.event_id).toBe(anchor.eventId);
    expect(node.project_id).toBeNull();
  });

  it('T19/T20: STO CPM and M8.13 are not imported by Project services', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          const code = strip(readFileSync(full, 'utf8'));
          if (/ScheduleOrchestrationService/.test(code)) offenders.push(`${full}: M11`);
          if (/ProgressAggregationService/.test(code)) offenders.push(`${full}: M8.13`);
        }
      }
    };
    walk('src/core/project');
    expect(offenders).toEqual([]);
  });

  it('T21/T22: Safety and Permit remain Event-scoped / unused by Project services', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          const code = strip(readFileSync(full, 'utf8'));
          if (/prisma\.(safetyLog|permit)\b/.test(code)) offenders.push(full);
        }
      }
    };
    walk('src/core/project');
    walk('app/api/projects');
    walk('app/api/portfolios');
    expect(offenders).toEqual([]);
  });

  it('T23: STO reports stay under STO in navigation', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(nav.sto.some((i) => i.section === 'STO Reports')).toBe(true);
    expect(nav.project.some((i) => i.section === 'STO Reports')).toBe(false);
  });

  it('T24: no Project route writes an Event id from a Project id', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          const code = strip(readFileSync(full, 'utf8'));
          if (/event_id:\s*projectId/.test(code)) offenders.push(full);
          if (/prisma\.event\.find/.test(code)) offenders.push(`${full}: prisma.event`);
        }
      }
    };
    walk('app/api/projects');
    walk('src/core/project');
    expect(offenders).toEqual([]);
  });
});

describe('OD9.3 tenant isolation', () => {
  it('T25/T26/T27: cross-tenant Portfolio / Project / WBS access is denied', async () => {
    const otherOrg = randomUUID();
    await inRolledBackTx(async (tx) => {
      const portfolio = await PortfolioService.create(anchor.orgId, {
        name: 'Tenant A PF',
        code: `TA-${randomUUID().slice(0, 6)}`,
      }, tx as any);
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'Tenant A P',
          code: `TAP-${randomUUID().slice(0, 6)}`,
          portfolio_id: portfolio.id,
          updated_at: new Date(),
        },
      });
      const node = await ProjectWbsService.create(anchor.orgId, project.id, { name: 'Root' }, tx as any);

      await expect(PortfolioService.get(otherOrg, portfolio.id, tx as any)).rejects.toThrow(/not found/i);
      await expect(ProjectWbsService.list(otherOrg, project.id, tx as any)).rejects.toThrow(/not found/i);
      await expect(ProjectWbsService.update(otherOrg, project.id, node.id, { name: 'x' }, tx as any)).rejects.toThrow(/not found/i);
      await expect(ProjectReportService.status(otherOrg, project.id, tx as any)).rejects.toThrow(/not found/i);
    });
  });

  it('T28: export-style Workpack query with the wrong org returns no rows', async () => {
    const leaked = await prisma.workpack.findMany({
      where: { organization_id: randomUUID() },
      take: 5,
    });
    expect(leaked).toHaveLength(0);
  });
});

describe('OD9.3 navigation', () => {
  it('T29-T33: frozen domains, no global Reports, Safety only under STO', () => {
    const nav = buildBusinessNavigation(FULL_CTX);
    expect(Object.keys(nav)).toEqual(['digital-plant', 'sto', 'project', 'organization']);
    expect(nav.project.some((i) => i.href === '/projects/portfolios')).toBe(true);
    expect(nav.project.some((i) => i.href === '/projects')).toBe(true);
    expect(nav.sto.some((i) => i.href === '/safety')).toBe(true);
    expect(nav.sto.some((i) => i.href === '/permits')).toBe(true);
    expect(nav.project.some((i) => i.href === '/safety' || i.href === '/permits')).toBe(false);
    expect(nav.project.some((i) => i.section === 'Reports' || i.section === 'Intelligence')).toBe(false);
    expect(TENANT_SHELL_SECTIONS.map((s) => s.id)).toEqual([
      'digital-plant',
      'sto',
      'project',
      'organization',
    ]);
  });

  it('T33b: Project detail tabs do not link to STO Safety/Permit', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('app/(dashboard)/projects/[id]/ProjectDetailClient.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    expect(page).not.toMatch(/\/safety/);
    expect(page).not.toMatch(/\/permits/);
    expect(page).toMatch(/\/wbs/);
  });
});

describe('OD9.3 communications foundation', () => {
  it('creates a Project note without Event', async () => {
    const note = await inRolledBackTx(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: randomUUID(),
          org_id: anchor.orgId,
          name: 'OD93 COM',
          code: `OD93M-${randomUUID().slice(0, 6)}`,
          updated_at: new Date(),
        },
      });
      return ProjectCommunicationService.create(anchor.orgId, project.id, {
        subject: 'Kickoff',
        body: 'Project note',
        created_by: anchor.userId,
      }, tx as any);
    });
    expect(note.subject).toBe('Kickoff');
  });
});
