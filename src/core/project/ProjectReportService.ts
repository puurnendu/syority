import { prisma } from '@/lib/prisma';

export class ProjectReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectReportError';
  }
}

/**
 * PROJECT reporting authority. Reads only Project / Workpack / Activity /
 * WbsNode / ScheduleBaseline. Never SafetyLog, Permit, Event, or M8.13.
 */
export class ProjectReportService {
  static async status(organizationId: string, projectId: string, db: typeof prisma = prisma) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      include: {
        portfolio: { select: { id: true, name: true, code: true } },
        _count: { select: { Workpack: true, wbsNodes: true, communications: true } },
      },
    });
    if (!project) throw new ProjectReportError('Project not found');

    const activities = await db.activity.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        workpack: { project_id: projectId, organization_id: organizationId, deleted_at: null },
      },
      select: {
        id: true,
        description: true,
        status: true,
        progress_percent: true,
        planned_start: true,
        planned_end: true,
        actual_start: true,
        actual_end: true,
        is_critical: true,
        total_float: true,
        early_start: true,
        early_finish: true,
        late_start: true,
        late_finish: true,
        duration_hours: true,
      },
      orderBy: { sequence_number: 'asc' },
    });

    const n = activities.length;
    const progress = n === 0 ? 0 : Math.round(activities.reduce((s, a) => s + (a.progress_percent ?? 0), 0) / n);
    const critical = activities.filter((a) => a.is_critical);
    const now = new Date();
    const overdue = activities.filter(
      (a) => a.planned_end && new Date(a.planned_end) < now && (a.progress_percent ?? 0) < 100
    );

    return {
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        planned_sd_date: project.planned_sd_date,
        planned_su_date: project.planned_su_date,
        portfolio: project.portfolio,
      },
      counts: {
        workpacks: project._count.Workpack,
        wbs_nodes: project._count.wbsNodes,
        activities: n,
        critical: critical.length,
        overdue: overdue.length,
        communications: project._count.communications,
      },
      progress,
      critical_path: critical.map((a) => ({
        id: a.id,
        description: a.description,
        total_float: a.total_float,
        early_start: a.early_start,
        early_finish: a.early_finish,
      })),
      overdue: overdue.map((a) => ({
        id: a.id,
        description: a.description,
        planned_end: a.planned_end,
        progress_percent: a.progress_percent,
      })),
      generated_at: new Date().toISOString(),
      authority: 'PROJECT',
    };
  }

  static async lookahead(organizationId: string, projectId: string, days: number, db: typeof prisma = prisma) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new ProjectReportError('Project not found');

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(1, days));

    const activities = await db.activity.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        workpack: { project_id: projectId, organization_id: organizationId, deleted_at: null },
        planned_start: { lte: end },
        OR: [{ planned_end: { gte: start } }, { planned_end: null }],
      },
      select: {
        id: true,
        description: true,
        planned_start: true,
        planned_end: true,
        progress_percent: true,
        status: true,
        is_critical: true,
      },
      orderBy: { planned_start: 'asc' },
    });

    const overdue = await db.activity.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        workpack: { project_id: projectId, organization_id: organizationId, deleted_at: null },
        planned_end: { lt: start },
        progress_percent: { lt: 100 },
      },
      select: {
        id: true,
        description: true,
        planned_end: true,
        progress_percent: true,
      },
    });

    return { days, activities, overdue, authority: 'PROJECT' };
  }
}
