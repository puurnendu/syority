import { prisma } from '@/lib/prisma';

export class ProjectBaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectBaselineError';
  }
}

/**
 * Compares the current Project schedule to a Project-owned ScheduleBaseline.
 * Does not read Event-scoped baselines or M11.
 */
export class ProjectBaselineCompareService {
  static async list(organizationId: string, projectId: string, db: typeof prisma = prisma) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new ProjectBaselineError('Project not found');
    return db.scheduleBaseline.findMany({
      where: { organization_id: organizationId, project_id: projectId },
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { baselineActivities: true } } },
    });
  }

  static async compare(organizationId: string, projectId: string, baselineId: string, db: typeof prisma = prisma) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      select: { id: true, planned_sd_date: true, planned_su_date: true },
    });
    if (!project) throw new ProjectBaselineError('Project not found');

    const baseline = await db.scheduleBaseline.findFirst({
      where: { id: baselineId, organization_id: organizationId, project_id: projectId },
    });
    if (!baseline) throw new ProjectBaselineError('Baseline not found');

    const [current, snap] = await Promise.all([
      db.activity.findMany({
        where: {
          organization_id: organizationId,
          deleted_at: null,
          workpack: { project_id: projectId, organization_id: organizationId, deleted_at: null },
        },
        select: {
          id: true,
          description: true,
          planned_start: true,
          planned_end: true,
          total_float: true,
          is_critical: true,
        },
      }),
      db.baselineActivity.findMany({
        where: { baseline_id: baselineId, organization_id: organizationId },
      }),
    ]);

    const snapById = new Map(snap.map((s) => [s.activity_id, s]));
    const rows = current.map((a) => {
      const b = snapById.get(a.id);
      const startVar =
        a.planned_start && b?.planned_start
          ? Math.round((new Date(a.planned_start).getTime() - new Date(b.planned_start).getTime()) / 86_400_000)
          : null;
      const finishVar =
        a.planned_end && b?.planned_finish
          ? Math.round((new Date(a.planned_end).getTime() - new Date(b.planned_finish).getTime()) / 86_400_000)
          : null;
      const floatVar =
        a.total_float != null && b?.total_float != null ? Number(a.total_float) - Number(b.total_float) : null;
      return {
        activity_id: a.id,
        description: a.description,
        current_start: a.planned_start,
        baseline_start: b?.planned_start ?? null,
        start_variance_days: startVar,
        current_finish: a.planned_end,
        baseline_finish: b?.planned_finish ?? null,
        finish_variance_days: finishVar,
        current_float: a.total_float,
        baseline_float: b?.total_float ?? null,
        float_variance: floatVar,
        is_critical: a.is_critical,
        in_baseline: !!b,
      };
    });

    const finishes = rows.filter((r) => r.finish_variance_days != null);
    return {
      baseline: { id: baseline.id, name: baseline.name, created_at: baseline.created_at, is_current: baseline.is_current },
      activity_count: rows.length,
      missing_from_baseline: rows.filter((r) => !r.in_baseline).length,
      mean_finish_variance_days:
        finishes.length === 0
          ? null
          : Math.round(finishes.reduce((s, r) => s + (r.finish_variance_days ?? 0), 0) / finishes.length),
      rows,
    };
  }
}
