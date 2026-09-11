import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ProjectWbsError, ProjectWbsService } from './ProjectWbsService';

/**
 * Creates a Project-owned workpack (event_id stays null) and optional activities.
 * Does not call WorkpackService — that path requires an Event.
 */
export class ProjectWorkpackService {
  static async createUnderWbs(
    organizationId: string,
    projectId: string,
    input: {
      site_id: string;
      title: string;
      created_by: string;
      wbs_node_id?: string | null;
      /** planned_* on the legacy Project chain must use audited override if supplied. */
      activity?: { description: string; duration_hours?: number; planned_start?: Date | null; planned_end?: Date | null };
    },
    db: typeof prisma = prisma
  ) {
    await ProjectWbsService.assertProject(organizationId, projectId, db);

    const site = await db.site.findFirst({
      where: { id: input.site_id, organization_id: organizationId },
      select: { id: true },
    });
    if (!site) throw new ProjectWbsError('Site not found in this organisation');

    if (input.wbs_node_id) {
      const node = await db.wbsNode.findFirst({
        where: { id: input.wbs_node_id, organization_id: organizationId, project_id: projectId },
        select: { id: true },
      });
      if (!node) throw new ProjectWbsError('WBS node not found in this project');
    }

    const workpack = await db.workpack.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        site_id: input.site_id,
        title: input.title,
        created_by: input.created_by,
        project_id: projectId,
        event_id: null,
        wbs_node_id: input.wbs_node_id ?? null,
        status: 'draft',
      },
    });

    let activity = null;
    if (input.activity) {
      activity = await db.activity.create({
        data: {
          id: randomUUID(),
          organization_id: organizationId,
          site_id: input.site_id,
          workpack_id: workpack.id,
          event_id: null,
          description: input.activity.description,
          duration_hours: input.activity.duration_hours ?? 8,
          // Sprint 1b — planned dates are not typed at create on any chain.
          planned_start: null,
          planned_end: null,
          schedule_source: 'workpack',
          created_by: input.created_by,
        },
      });

      if (input.activity.planned_start || input.activity.planned_end) {
        const { PlannedDateAuthority } = await import('@/core/schedule/PlannedDateAuthority');
        activity = await PlannedDateAuthority.applyOverride(
          {
            organizationId,
            activityId: activity.id,
            userId: input.created_by,
            reason: 'Initial planned dates on legacy Project workpack create',
            source: 'project_workpack',
            planned_start: input.activity.planned_start,
            planned_end: input.activity.planned_end,
          },
          db
        );
      }
    }

    return { workpack, activity };
  }
}
