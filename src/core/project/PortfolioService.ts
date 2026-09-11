import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

type Db = typeof prisma;

export class PortfolioAccessError extends Error {
  constructor(message = 'Portfolio not found') {
    super(message);
    this.name = 'PortfolioAccessError';
  }
}

export type PortfolioCreateInput = {
  name: string;
  code: string;
  description?: string | null;
  status?: string;
  owner_user_id?: string | null;
  category?: string | null;
  start_date?: Date | null;
  finish_date?: Date | null;
};

/**
 * PROJECT-domain Portfolio authority. Never reads Event / Safety / Permit / M8.13.
 */
export class PortfolioService {
  static async list(organizationId: string, db: Db = prisma) {
    return db.portfolio.findMany({
      where: { organization_id: organizationId, archived_at: null },
      include: { _count: { select: { projects: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  static async get(organizationId: string, portfolioId: string, db: Db = prisma) {
    const portfolio = await db.portfolio.findFirst({
      where: { id: portfolioId, organization_id: organizationId },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            planned_sd_date: true,
            planned_su_date: true,
            actual_sd_date: true,
            actual_su_date: true,
            _count: { select: { Workpack: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!portfolio) throw new PortfolioAccessError();
    return portfolio;
  }

  static async create(organizationId: string, input: PortfolioCreateInput, db: Db = prisma) {
    const name = input.name.trim();
    const code = input.code.trim();
    if (!name || !code) throw new Error('name and code are required');
    return db.portfolio.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        name,
        code,
        description: input.description?.trim() || null,
        status: input.status?.trim() || 'active',
        owner_user_id: input.owner_user_id || null,
        category: input.category?.trim() || null,
        start_date: input.start_date ?? null,
        finish_date: input.finish_date ?? null,
        updated_at: new Date(),
      },
    });
  }

  static async update(
    organizationId: string,
    portfolioId: string,
    input: Partial<PortfolioCreateInput> & { archived_at?: Date | null },
    db: Db = prisma
  ) {
    await this.get(organizationId, portfolioId, db);
    return db.portfolio.update({
      where: { id: portfolioId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.owner_user_id !== undefined ? { owner_user_id: input.owner_user_id } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.start_date !== undefined ? { start_date: input.start_date } : {}),
        ...(input.finish_date !== undefined ? { finish_date: input.finish_date } : {}),
        ...(input.archived_at !== undefined ? { archived_at: input.archived_at } : {}),
        updated_at: new Date(),
      },
    });
  }

  static async archive(organizationId: string, portfolioId: string, db: Db = prisma) {
    return this.update(organizationId, portfolioId, { archived_at: new Date(), status: 'archived' }, db);
  }

  /**
   * Portfolio metrics from Project-domain data only.
   * Does not call ProgressAggregationService / EvmSnapshot / SafetyLog / Event.
   */
  static async dashboard(organizationId: string, portfolioId: string, db: Db = prisma) {
    const portfolio = await this.get(organizationId, portfolioId, db);
    const now = new Date();
    const projects = portfolio.projects;

    const activeStatuses = new Set(['Planning', 'active', 'Active', 'In Progress', 'in_progress']);
    const completedStatuses = new Set(['Complete', 'Completed', 'closed', 'Closed']);

    const active = projects.filter((p) => activeStatuses.has(p.status) || !completedStatuses.has(p.status));
    const completed = projects.filter((p) => completedStatuses.has(p.status));
    const delayed = projects.filter((p) => {
      if (!p.planned_su_date || completedStatuses.has(p.status)) return false;
      return new Date(p.planned_su_date) < now && !p.actual_su_date;
    });
    const atRisk = delayed;

    const withDates = projects.filter((p) => p.planned_sd_date && p.planned_su_date);
    const dateVarianceDays = withDates.map((p) => {
      const planned = new Date(p.planned_su_date!).getTime();
      const actual = p.actual_su_date ? new Date(p.actual_su_date).getTime() : now.getTime();
      return Math.round((actual - planned) / 86_400_000);
    });

    const projectIds = projects.map((p) => p.id);
    const activities = projectIds.length
      ? await db.activity.findMany({
          where: {
            organization_id: organizationId,
            deleted_at: null,
            workpack: { project_id: { in: projectIds }, deleted_at: null },
          },
          select: {
            id: true,
            progress_percent: true,
            planned_end: true,
            is_critical: true,
            workpack: { select: { project_id: true } },
          },
        })
      : [];

    const progressByProject = new Map<string, { sum: number; n: number; critical: number }>();
    for (const a of activities) {
      const pid = a.workpack?.project_id;
      if (!pid) continue;
      const cur = progressByProject.get(pid) ?? { sum: 0, n: 0, critical: 0 };
      cur.sum += a.progress_percent ?? 0;
      cur.n += 1;
      if (a.is_critical) cur.critical += 1;
      progressByProject.set(pid, cur);
    }

    const projectHealth = projects.map((p) => {
      const prog = progressByProject.get(p.id);
      const progress = prog && prog.n > 0 ? Math.round(prog.sum / prog.n) : 0;
      const isDelayed = delayed.some((d) => d.id === p.id);
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        status: p.status,
        progress,
        delayed: isDelayed,
        criticalActivities: prog?.critical ?? 0,
        planned_sd_date: p.planned_sd_date,
        planned_su_date: p.planned_su_date,
        actual_su_date: p.actual_su_date,
      };
    });

    const upcomingMilestones = projects
      .filter((p) => p.planned_su_date && new Date(p.planned_su_date) >= now)
      .sort((a, b) => new Date(a.planned_su_date!).getTime() - new Date(b.planned_su_date!).getTime())
      .slice(0, 8)
      .map((p) => ({
        project_id: p.id,
        project_name: p.name,
        kind: 'planned_finish',
        date: p.planned_su_date,
      }));

    const portfolioProgress =
      projectHealth.length === 0
        ? 0
        : Math.round(projectHealth.reduce((s, p) => s + p.progress, 0) / projectHealth.length);

    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        code: portfolio.code,
        status: portfolio.status,
        category: portfolio.category,
        start_date: portfolio.start_date,
        finish_date: portfolio.finish_date,
      },
      counts: {
        projects: projects.length,
        active: active.length,
        completed: completed.length,
        delayed: delayed.length,
        at_risk: atRisk.length,
      },
      portfolio_progress: portfolioProgress,
      mean_finish_variance_days:
        dateVarianceDays.length === 0
          ? null
          : Math.round(dateVarianceDays.reduce((s, n) => s + n, 0) / dateVarianceDays.length),
      project_health: projectHealth,
      upcoming_milestones: upcomingMilestones,
      critical_projects: projectHealth.filter((p) => p.criticalActivities > 0 || p.delayed),
    };
  }
}
