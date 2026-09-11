/**
 * M7.6D — Dashboard Versioning Service
 *
 * Version control for dashboard definitions.
 * Supports save, revert, compare, publish, and version history.
 */

import { prisma } from '@/lib/prisma';

export interface DashboardVersion {
  id: string;
  dashboardId: string;
  versionNumber: number;
  label: string;
  createdBy: string;
  createdAt: Date;
  layoutSnapshot: any;
  widgetSnapshot: any;
  changeDescription: string;
  isPublished: boolean;
}

export class DashboardVersioningService {
  /**
   * Create a new version from the current dashboard state.
   */
  static async createVersion(
    dashboardId: string,
    createdBy: string,
    changeDescription: string,
  ): Promise<DashboardVersion> {
    // Get current dashboard with widgets
    const dashboard = await prisma.ois_dashboard_definitions.findUniqueOrThrow({
      where: { id: dashboardId },
      include: { widgets: true },
    });

    // Get next version number
    const lastVersion = await prisma.ois_dashboard_versions.findFirst({
      where: { dashboard_id: dashboardId },
      orderBy: { version_number: 'desc' },
    });
    const nextVersion = (lastVersion?.version_number ?? 0) + 1;

    // Create version record
    const version = await prisma.ois_dashboard_versions.create({
      data: {
        dashboard_id: dashboardId,
        version_number: nextVersion,
        label: `v${nextVersion}`,
        created_by: createdBy,
        layout_snapshot: dashboard.layout_config ?? {},
        widget_snapshot: dashboard.widgets.map((w: any) => ({
          id: w.id,
          widget_definition_id: w.widget_definition_id,
          grid_x: w.grid_x,
          grid_y: w.grid_y,
          grid_w: w.grid_w,
          grid_h: w.grid_h,
          title_override: w.title_override,
          visualization_config: w.visualization_config,
          provider_params: w.provider_params,
        })),
        change_description: changeDescription,
        is_published: false,
      },
    });

    return {
      id: version.id,
      dashboardId: version.dashboard_id,
      versionNumber: version.version_number,
      label: version.label,
      createdBy: version.created_by,
      createdAt: version.created_at,
      layoutSnapshot: version.layout_snapshot,
      widgetSnapshot: version.widget_snapshot,
      changeDescription: version.change_description,
      isPublished: version.is_published,
    };
  }

  /**
   * Get version history for a dashboard.
   */
  static async getHistory(dashboardId: string): Promise<DashboardVersion[]> {
    const versions = await prisma.ois_dashboard_versions.findMany({
      where: { dashboard_id: dashboardId },
      orderBy: { version_number: 'desc' },
      take: 50,
    });

    return versions.map((v: any) => ({
      id: v.id,
      dashboardId: v.dashboard_id,
      versionNumber: v.version_number,
      label: v.label,
      createdBy: v.created_by,
      createdAt: v.created_at,
      layoutSnapshot: v.layout_snapshot,
      widgetSnapshot: v.widget_snapshot,
      changeDescription: v.change_description,
      isPublished: v.is_published,
    }));
  }

  /**
   * Revert a dashboard to a specific version.
   */
  static async revert(dashboardId: string, versionId: string, revertedBy: string): Promise<void> {
    const version = await prisma.ois_dashboard_versions.findUniqueOrThrow({
      where: { id: versionId },
    });

    // Create new version record for the revert
    await DashboardVersioningService.createVersion(
      dashboardId,
      revertedBy,
      `Reverted to ${version.label}`,
    );

    // Update dashboard layout
    await prisma.ois_dashboard_definitions.update({
      where: { id: dashboardId },
      data: { layout_config: version.layout_snapshot },
    });

    // Delete current widgets and recreate from snapshot
    await prisma.ois_dashboard_widgets.deleteMany({
      where: { dashboard_id: dashboardId },
    });

    const widgetSnapshot = (version.widget_snapshot as any[]) ?? [];
    for (const ws of widgetSnapshot) {
      await prisma.ois_dashboard_widgets.create({
        data: {
          dashboard_id: dashboardId,
          widget_definition_id: ws.widget_definition_id,
          grid_x: ws.grid_x,
          grid_y: ws.grid_y,
          grid_w: ws.grid_w,
          grid_h: ws.grid_h,
          title_override: ws.title_override,
          visualization_config: ws.visualization_config,
          provider_params: ws.provider_params,
        },
      });
    }
  }

  /**
   * Publish a specific version.
   */
  static async publish(dashboardId: string, versionId: string): Promise<void> {
    // Unpublish all previous
    await prisma.ois_dashboard_versions.updateMany({
      where: { dashboard_id: dashboardId, is_published: true },
      data: { is_published: false },
    });

    // Publish the specified version
    await prisma.ois_dashboard_versions.update({
      where: { id: versionId },
      data: { is_published: true },
    });

    // Update dashboard status
    await prisma.ois_dashboard_definitions.update({
      where: { id: dashboardId },
      data: { status: 'published', published_at: new Date() },
    });
  }

  /**
   * Compare two versions — returns a diff summary.
   */
  static async compare(versionIdA: string, versionIdB: string): Promise<{
    addedWidgets: string[];
    removedWidgets: string[];
    movedWidgets: string[];
    configChanges: string[];
  }> {
    const [vA, vB] = await Promise.all([
      prisma.ois_dashboard_versions.findUniqueOrThrow({ where: { id: versionIdA } }),
      prisma.ois_dashboard_versions.findUniqueOrThrow({ where: { id: versionIdB } }),
    ]);

    const widgetsA = (vA.widget_snapshot as any[]) ?? [];
    const widgetsB = (vB.widget_snapshot as any[]) ?? [];
    const idsA = new Set(widgetsA.map((w) => w.widget_definition_id));
    const idsB = new Set(widgetsB.map((w) => w.widget_definition_id));

    const added = widgetsB.filter((w) => !idsA.has(w.widget_definition_id)).map((w) => w.widget_definition_id);
    const removed = widgetsA.filter((w) => !idsB.has(w.widget_definition_id)).map((w) => w.widget_definition_id);

    const moved: string[] = [];
    const configChanges: string[] = [];

    for (const wB of widgetsB) {
      const wA = widgetsA.find((w) => w.id === wB.id);
      if (!wA) continue;
      if (wA.grid_x !== wB.grid_x || wA.grid_y !== wB.grid_y || wA.grid_w !== wB.grid_w || wA.grid_h !== wB.grid_h) {
        moved.push(wB.id);
      }
      if (JSON.stringify(wA.visualization_config) !== JSON.stringify(wB.visualization_config)) {
        configChanges.push(wB.id);
      }
    }

    return { addedWidgets: added, removedWidgets: removed, movedWidgets: moved, configChanges };
  }
}
