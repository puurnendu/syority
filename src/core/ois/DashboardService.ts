/**
 * M7.6C — Dashboard Service
 *
 * CRUD for dashboard definitions, pages, widget instances.
 * Handles versioning, publishing, archiving, cloning, sharing.
 */

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { DashboardType, ExportFormat, ScheduleFrequency } from './WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateDashboardInput {
  name: string;
  slug: string;
  description?: string;
  dashboardType?: DashboardType;
  category?: string;
  icon?: string;
  theme?: 'light' | 'dark';
  layoutConfig?: Record<string, any>;
  brandingProfileId?: string;
  organizationId: string;
  createdBy: string;
}

export interface UpdateDashboardInput {
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  theme?: 'light' | 'dark';
  layoutConfig?: Record<string, any>;
  brandingProfileId?: string;
  revisionNotes?: string;
  updatedBy: string;
}

export interface AddWidgetInput {
  widgetDefinitionId: string;
  pageId?: string;
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
  titleOverride?: string;
  subtitle?: string;
  providerParams?: Record<string, any>;
  visualizationConfig?: Record<string, any>;
  thresholdConfig?: Record<string, any>;
}

export interface UpdateWidgetInput {
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
  titleOverride?: string;
  subtitle?: string;
  iconOverride?: string;
  colorOverride?: string;
  providerParams?: Record<string, any>;
  visualizationConfig?: Record<string, any>;
  thresholdConfig?: Record<string, any>;
  conditionalColors?: any[];
  numberFormat?: string;
  dateFormat?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  footerHtml?: string;
  refreshIntervalOverride?: number;
  isVisible?: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class DashboardService {

  // ── Dashboard CRUD ────────────────────────────────────────────────────────

  static async list(organizationId: string, opts?: {
    type?: DashboardType;
    category?: string;
    includeTemplates?: boolean;
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 25;
    const where: any = {
      OR: [
        { organization_id: organizationId },
        { is_template: true, is_system: true },
      ],
    };
    if (opts?.type) where.dashboard_type = opts.type;
    if (opts?.category) where.category = opts.category;
    if (!opts?.includeArchived) where.is_archived = false;
    if (!opts?.includeTemplates) {
      where.OR = [{ organization_id: organizationId }];
    }

    const [dashboards, total] = await Promise.all([
      prisma.ois_dashboard_definitions.findMany({
        where,
        orderBy: [{ is_template: 'desc' }, { updated_at: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { widgets: true, pages: true } },
        },
      }),
      prisma.ois_dashboard_definitions.count({ where }),
    ]);

    return { dashboards, total, page, pageSize };
  }

  static async getById(id: string, includeWidgets = true) {
    return prisma.ois_dashboard_definitions.findUniqueOrThrow({
      where: { id },
      include: {
        pages: {
          orderBy: { sort_order: 'asc' },
          include: includeWidgets ? {
            widgets: {
              orderBy: { sort_order: 'asc' },
              include: { widget_definition: true },
            },
          } : undefined,
        },
        widgets: includeWidgets ? {
          orderBy: { sort_order: 'asc' },
          include: { widget_definition: true },
        } : undefined,
        shares: true,
        _count: { select: { versions: true, snapshots: true, schedules: true } },
      },
    });
  }

  static async create(input: CreateDashboardInput) {
    const dashboard = await prisma.ois_dashboard_definitions.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        dashboard_type: input.dashboardType ?? 'dashboard',
        category: input.category,
        icon: input.icon,
        theme: input.theme ?? 'light',
        layout_config: input.layoutConfig ?? {},
        branding_profile_id: input.brandingProfileId,
        organization_id: input.organizationId,
        owner_id: input.createdBy,
        created_by: input.createdBy,
      },
    });

    // Create default first page
    await prisma.ois_dashboard_pages.create({
      data: {
        dashboard_id: dashboard.id,
        page_number: 1,
        title: 'Overview',
        sort_order: 0,
      },
    });

    await AuditService.logAction({
      action: 'ois.dashboard.create',
      target: dashboard.id,
      userId: input.createdBy,
      orgId: input.organizationId,
      meta: { name: input.name, type: input.dashboardType },
    });

    return dashboard;
  }

  static async update(id: string, input: UpdateDashboardInput) {
    const dashboard = await prisma.ois_dashboard_definitions.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        icon: input.icon,
        theme: input.theme,
        layout_config: input.layoutConfig,
        branding_profile_id: input.brandingProfileId,
        revision_notes: input.revisionNotes,
        updated_by: input.updatedBy,
      },
    });

    return dashboard;
  }

  static async delete(id: string, userId: string, orgId: string) {
    const dashboard = await prisma.ois_dashboard_definitions.findUnique({
      where: { id },
      select: { is_system: true, name: true },
    });
    if (dashboard?.is_system) {
      throw new Error('Cannot delete a system template.');
    }

    await prisma.ois_dashboard_definitions.delete({ where: { id } });

    await AuditService.logAction({
      action: 'ois.dashboard.delete',
      target: id,
      userId,
      orgId,
      meta: { name: dashboard?.name },
    });
  }

  // ── Publishing ────────────────────────────────────────────────────────────

  static async publish(id: string, userId: string) {
    // Create version snapshot before publishing
    await DashboardService.createVersion(id, userId, 'Published');

    return prisma.ois_dashboard_definitions.update({
      where: { id },
      data: {
        is_published: true,
        is_archived: false,
        version: { increment: 1 },
        updated_by: userId,
      },
    });
  }

  static async archive(id: string, userId: string) {
    return prisma.ois_dashboard_definitions.update({
      where: { id },
      data: {
        is_archived: true,
        is_published: false,
        updated_by: userId,
      },
    });
  }

  // ── Cloning ───────────────────────────────────────────────────────────────

  static async clone(id: string, newName: string, newSlug: string, userId: string, orgId: string) {
    const source = await DashboardService.getById(id, true);

    // Create the cloned dashboard
    const cloned = await prisma.ois_dashboard_definitions.create({
      data: {
        name: newName,
        slug: newSlug,
        description: source.description,
        dashboard_type: source.dashboard_type,
        category: source.category,
        icon: source.icon,
        theme: source.theme,
        layout_config: source.layout_config ?? {},
        branding_profile_id: source.branding_profile_id,
        organization_id: orgId,
        owner_id: userId,
        created_by: userId,
      },
    });

    // Clone pages
    const pageMap = new Map<string, string>(); // oldId → newId
    for (const page of source.pages) {
      const newPage = await prisma.ois_dashboard_pages.create({
        data: {
          dashboard_id: cloned.id,
          page_number: page.page_number,
          title: page.title,
          grid_columns: page.grid_columns,
          grid_row_height: page.grid_row_height,
          background_color: page.background_color,
          sort_order: page.sort_order,
        },
      });
      pageMap.set(page.id, newPage.id);
    }

    // Clone widgets
    for (const widget of source.widgets) {
      await prisma.ois_dashboard_widgets.create({
        data: {
          dashboard_id: cloned.id,
          page_id: widget.page_id ? pageMap.get(widget.page_id) ?? null : null,
          widget_definition_id: widget.widget_definition_id,
          grid_x: widget.grid_x,
          grid_y: widget.grid_y,
          grid_w: widget.grid_w,
          grid_h: widget.grid_h,
          min_w: widget.min_w,
          min_h: widget.min_h,
          title_override: widget.title_override,
          subtitle: widget.subtitle,
          icon_override: widget.icon_override,
          color_override: widget.color_override,
          provider_params: widget.provider_params ?? {},
          visualization_config: widget.visualization_config ?? {},
          threshold_config: widget.threshold_config,
          conditional_colors: widget.conditional_colors,
          number_format: widget.number_format,
          date_format: widget.date_format,
          show_header: widget.show_header,
          show_footer: widget.show_footer,
          footer_html: widget.footer_html,
          sort_order: widget.sort_order,
        },
      });
    }

    await AuditService.logAction({
      action: 'ois.dashboard.clone',
      target: cloned.id,
      userId,
      orgId,
      meta: { sourceId: id, sourceName: source.name, newName },
    });

    return cloned;
  }

  // ── Widget Management ─────────────────────────────────────────────────────

  static async addWidget(dashboardId: string, input: AddWidgetInput) {
    return prisma.ois_dashboard_widgets.create({
      data: {
        dashboard_id: dashboardId,
        page_id: input.pageId,
        widget_definition_id: input.widgetDefinitionId,
        grid_x: input.gridX ?? 0,
        grid_y: input.gridY ?? 0,
        grid_w: input.gridW ?? 4,
        grid_h: input.gridH ?? 3,
        title_override: input.titleOverride,
        subtitle: input.subtitle,
        provider_params: input.providerParams ?? {},
        visualization_config: input.visualizationConfig ?? {},
        threshold_config: input.thresholdConfig,
      },
      include: { widget_definition: true },
    });
  }

  static async updateWidget(widgetId: string, input: UpdateWidgetInput) {
    return prisma.ois_dashboard_widgets.update({
      where: { id: widgetId },
      data: {
        grid_x: input.gridX,
        grid_y: input.gridY,
        grid_w: input.gridW,
        grid_h: input.gridH,
        title_override: input.titleOverride,
        subtitle: input.subtitle,
        icon_override: input.iconOverride,
        color_override: input.colorOverride,
        provider_params: input.providerParams,
        visualization_config: input.visualizationConfig,
        threshold_config: input.thresholdConfig,
        conditional_colors: input.conditionalColors,
        number_format: input.numberFormat,
        date_format: input.dateFormat,
        show_header: input.showHeader,
        show_footer: input.showFooter,
        footer_html: input.footerHtml,
        refresh_interval_override: input.refreshIntervalOverride,
        is_visible: input.isVisible,
      },
      include: { widget_definition: true },
    });
  }

  static async removeWidget(widgetId: string) {
    return prisma.ois_dashboard_widgets.delete({ where: { id: widgetId } });
  }

  static async batchUpdateLayout(
    dashboardId: string,
    layouts: Array<{ id: string; gridX: number; gridY: number; gridW: number; gridH: number }>,
  ) {
    const ops = layouts.map((l) =>
      prisma.ois_dashboard_widgets.update({
        where: { id: l.id },
        data: { grid_x: l.gridX, grid_y: l.gridY, grid_w: l.gridW, grid_h: l.gridH },
      })
    );
    return prisma.$transaction(ops);
  }

  // ── Page Management ───────────────────────────────────────────────────────

  static async addPage(dashboardId: string, title: string) {
    const maxPage = await prisma.ois_dashboard_pages.findFirst({
      where: { dashboard_id: dashboardId },
      orderBy: { page_number: 'desc' },
      select: { page_number: true, sort_order: true },
    });
    const pageNumber = (maxPage?.page_number ?? 0) + 1;
    const sortOrder = (maxPage?.sort_order ?? 0) + 1;

    const page = await prisma.ois_dashboard_pages.create({
      data: {
        dashboard_id: dashboardId,
        page_number: pageNumber,
        title,
        sort_order: sortOrder,
      },
    });

    // Update dashboard page count
    await prisma.ois_dashboard_definitions.update({
      where: { id: dashboardId },
      data: { page_count: pageNumber },
    });

    return page;
  }

  static async removePage(pageId: string) {
    return prisma.ois_dashboard_pages.delete({ where: { id: pageId } });
  }

  // ── Versioning ────────────────────────────────────────────────────────────

  static async createVersion(dashboardId: string, userId: string, summary?: string) {
    const dashboard = await DashboardService.getById(dashboardId, true);

    // Compute next version number
    const lastVersion = await prisma.ois_dashboard_versions.findFirst({
      where: { dashboard_id: dashboardId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    const snapshot = {
      name: dashboard.name,
      dashboardType: dashboard.dashboard_type,
      layoutConfig: dashboard.layout_config,
      theme: dashboard.theme,
      pages: dashboard.pages.map((p) => ({
        id: p.id,
        pageNumber: p.page_number,
        title: p.title,
        gridColumns: p.grid_columns,
        gridRowHeight: p.grid_row_height,
      })),
      widgets: dashboard.widgets.map((w) => ({
        id: w.id,
        widgetDefinitionId: w.widget_definition_id,
        pageId: w.page_id,
        gridX: w.grid_x,
        gridY: w.grid_y,
        gridW: w.grid_w,
        gridH: w.grid_h,
        titleOverride: w.title_override,
        providerParams: w.provider_params,
        visualizationConfig: w.visualization_config,
        thresholdConfig: w.threshold_config,
      })),
    };

    return prisma.ois_dashboard_versions.create({
      data: {
        dashboard_id: dashboardId,
        version: nextVersion,
        snapshot,
        change_summary: summary ?? `Version ${nextVersion}`,
        created_by: userId,
      },
    });
  }

  static async listVersions(dashboardId: string) {
    return prisma.ois_dashboard_versions.findMany({
      where: { dashboard_id: dashboardId },
      orderBy: { version: 'desc' },
    });
  }

  static async restoreVersion(versionId: string, userId: string) {
    const version = await prisma.ois_dashboard_versions.findUniqueOrThrow({
      where: { id: versionId },
    });

    const snapshot = version.snapshot as any;
    const dashboardId = version.dashboard_id;

    // Clear current widgets
    await prisma.ois_dashboard_widgets.deleteMany({ where: { dashboard_id: dashboardId } });

    // Restore widgets from snapshot
    if (snapshot.widgets?.length) {
      for (const w of snapshot.widgets) {
        await prisma.ois_dashboard_widgets.create({
          data: {
            dashboard_id: dashboardId,
            widget_definition_id: w.widgetDefinitionId,
            page_id: w.pageId,
            grid_x: w.gridX ?? 0,
            grid_y: w.gridY ?? 0,
            grid_w: w.gridW ?? 4,
            grid_h: w.gridH ?? 3,
            title_override: w.titleOverride,
            provider_params: w.providerParams ?? {},
            visualization_config: w.visualizationConfig ?? {},
            threshold_config: w.thresholdConfig,
          },
        });
      }
    }

    // Update dashboard metadata
    await prisma.ois_dashboard_definitions.update({
      where: { id: dashboardId },
      data: {
        layout_config: snapshot.layoutConfig ?? {},
        theme: snapshot.theme ?? 'light',
        updated_by: userId,
        revision_notes: `Restored from version ${version.version}`,
      },
    });

    return version;
  }

  // ── Sharing ───────────────────────────────────────────────────────────────

  static async share(dashboardId: string, opts: {
    sharedWithType: string;
    sharedWithValue: string;
    permission?: string;
    createdBy: string;
  }) {
    return prisma.ois_dashboard_shares.upsert({
      where: {
        dashboard_id_shared_with_type_shared_with_value: {
          dashboard_id: dashboardId,
          shared_with_type: opts.sharedWithType,
          shared_with_value: opts.sharedWithValue,
        },
      },
      create: {
        dashboard_id: dashboardId,
        shared_with_type: opts.sharedWithType,
        shared_with_value: opts.sharedWithValue,
        permission: opts.permission ?? 'view',
        created_by: opts.createdBy,
      },
      update: {
        permission: opts.permission ?? 'view',
      },
    });
  }

  static async removeShare(shareId: string) {
    return prisma.ois_dashboard_shares.delete({ where: { id: shareId } });
  }

  // ── Widget Definitions ────────────────────────────────────────────────────

  static async listWidgetDefinitions(opts?: {
    category?: string;
    organizationId?: string;
  }) {
    const where: any = { is_active: true };
    if (opts?.category) where.category = opts.category;

    // Include system widgets + org-specific widgets
    if (opts?.organizationId) {
      where.OR = [
        { is_system: true },
        { organization_id: opts.organizationId },
        { organization_id: null },
      ];
    }

    return prisma.ois_widget_definitions.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  static async getWidgetDefinition(slug: string) {
    return prisma.ois_widget_definitions.findUniqueOrThrow({
      where: { slug },
    });
  }
}
