/**
 * M7.6B — Saved Report Views
 *
 * CRUD for planner-saved parameter sets.
 * Views can be shared across org and reused by schedules.
 */

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export class SavedViewService {
  /**
   * List saved views for a user (their own + shared views in the org).
   */
  static async listForUser(organizationId: string, userId: string) {
    return prisma.report_saved_views.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        OR: [{ user_id: userId }, { is_shared: true }],
      },
      include: { definition: { select: { name: true, slug: true } } },
      orderBy: [{ updated_at: 'desc' }],
    });
  }

  /**
   * List views for a specific definition.
   */
  static async listForDefinition(definitionId: string, organizationId: string, userId: string) {
    return prisma.report_saved_views.findMany({
      where: {
        definition_id: definitionId,
        organization_id: organizationId,
        is_active: true,
        OR: [{ user_id: userId }, { is_shared: true }],
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  /**
   * Get a single view by ID.
   */
  static async getById(id: string) {
    return prisma.report_saved_views.findUniqueOrThrow({
      where: { id },
      include: { definition: { select: { name: true, slug: true } } },
    });
  }

  /**
   * Create a saved view.
   */
  static async create(data: {
    organizationId: string;
    definitionId: string;
    userId: string;
    name: string;
    description?: string;
    parameters: Record<string, any>;
    selectedSections?: string[];
    outputFormat?: string;
    layoutId?: string;
    includeAi?: boolean;
    isShared?: boolean;
  }) {
    const view = await prisma.report_saved_views.create({
      data: {
        organization_id: data.organizationId,
        definition_id: data.definitionId,
        user_id: data.userId,
        name: data.name,
        description: data.description,
        parameters: data.parameters,
        selected_sections: data.selectedSections ?? [],
        output_format: data.outputFormat ?? 'pdf',
        layout_id: data.layoutId,
        include_ai: data.includeAi ?? false,
        is_shared: data.isShared ?? false,
      },
      include: { definition: { select: { name: true, slug: true } } },
    });

    await AuditService.log({
      user_id: data.userId,
      organization_id: data.organizationId,
      action: 'CREATE',
      model_name: 'report_saved_views',
      model_id: view.id,
    }).catch(() => {});

    return view;
  }

  /**
   * Update a saved view (only owner can update).
   */
  static async update(id: string, data: Record<string, any>, userId: string) {
    const existing = await prisma.report_saved_views.findUniqueOrThrow({ where: { id } });

    // Only owner can update
    if (existing.user_id !== userId) {
      throw new Error('Only the view owner can update this saved view.');
    }

    const updated = await prisma.report_saved_views.update({
      where: { id },
      data,
      include: { definition: { select: { name: true, slug: true } } },
    });

    await AuditService.log({
      user_id: userId,
      organization_id: existing.organization_id,
      action: 'UPDATE',
      model_name: 'report_saved_views',
      model_id: id,
    }).catch(() => {});

    return updated;
  }

  /**
   * Delete a saved view (only owner can delete).
   */
  static async delete(id: string, userId: string) {
    const existing = await prisma.report_saved_views.findUniqueOrThrow({ where: { id } });
    if (existing.user_id !== userId) {
      throw new Error('Only the view owner can delete this saved view.');
    }

    // Check if referenced by schedules
    const scheduleCount = await prisma.report_schedules.count({ where: { saved_view_id: id } });
    if (scheduleCount > 0) {
      throw new Error(`Cannot delete: ${scheduleCount} schedule(s) reference this view.`);
    }

    const deleted = await prisma.report_saved_views.delete({ where: { id } });

    await AuditService.log({
      user_id: userId,
      organization_id: existing.organization_id,
      action: 'DELETE',
      model_name: 'report_saved_views',
      model_id: id,
    }).catch(() => {});

    return deleted;
  }

  /**
   * Resolve parameters from a saved view (used by schedules at trigger time).
   */
  static async resolveParams(viewId: string): Promise<{
    parameters: Record<string, any>;
    selectedSections: string[];
    outputFormat: string;
    layoutId: string | null;
    includeAi: boolean;
  }> {
    const view = await prisma.report_saved_views.findUniqueOrThrow({ where: { id: viewId } });
    return {
      parameters: view.parameters as Record<string, any>,
      selectedSections: view.selected_sections as string[],
      outputFormat: view.output_format,
      layoutId: view.layout_id,
      includeAi: view.include_ai,
    };
  }

  /**
   * Duplicate an existing saved view.
   */
  static async duplicate(id: string, userId: string, newName?: string) {
    const existing = await prisma.report_saved_views.findUniqueOrThrow({ where: { id } });
    const name = newName || `${existing.name} (Copy)`;

    return SavedViewService.create({
      organizationId: existing.organization_id,
      definitionId: existing.definition_id,
      userId,
      name,
      description: existing.description ?? undefined,
      parameters: (existing.parameters as Record<string, any>) ?? {},
      selectedSections: (existing.selected_sections as string[]) ?? [],
      outputFormat: existing.output_format,
      layoutId: existing.layout_id ?? undefined,
      includeAi: existing.include_ai,
      isShared: false,
    });
  }

  /**
   * Save As a new template with optional overrides.
   */
  static async saveAs(
    id: string,
    userId: string,
    newName: string,
    overrides?: {
      parameters?: Record<string, any>;
      selectedSections?: string[];
      outputFormat?: string;
      layoutId?: string;
      isShared?: boolean;
    }
  ) {
    const existing = await prisma.report_saved_views.findUniqueOrThrow({ where: { id } });

    return SavedViewService.create({
      organizationId: existing.organization_id,
      definitionId: existing.definition_id,
      userId,
      name: newName,
      description: existing.description ?? undefined,
      parameters: overrides?.parameters ?? ((existing.parameters as Record<string, any>) || {}),
      selectedSections: overrides?.selectedSections ?? ((existing.selected_sections as string[]) || []),
      outputFormat: overrides?.outputFormat ?? existing.output_format,
      layoutId: overrides?.layoutId ?? existing.layout_id ?? undefined,
      includeAi: existing.include_ai,
      isShared: overrides?.isShared ?? false,
    });
  }

  /**
   * Resolve precedence hierarchy:
   * PLATFORM DEFAULT -> TENANT CONFIGURATION -> EVENT CONFIGURATION -> USER PERSONAL VIEW
   */
  static async resolveHierarchy(opts: {
    definitionId: string;
    organizationId: string;
    userId: string;
    eventId?: string;
    savedViewId?: string;
  }) {
    // 1. Platform Default (from Definition)
    const definition = await prisma.report_definitions.findUniqueOrThrow({
      where: { id: opts.definitionId },
      include: { default_layout: true },
    });

    let effective = {
      parameters: {} as Record<string, any>,
      selectedSections: (definition.default_sections as string[]) || [],
      outputFormat: definition.default_output || 'pdf',
      layoutId: definition.default_layout_id,
      precedenceLevel: 'PLATFORM_DEFAULT',
    };

    // 2. Tenant Configuration (Organization default layout)
    const orgLayout = await prisma.report_layouts.findFirst({
      where: { organization_id: opts.organizationId, is_active: true },
      orderBy: { created_at: 'asc' },
    });
    if (orgLayout) {
      effective.layoutId = orgLayout.id;
      effective.precedenceLevel = 'TENANT_CONFIGURATION';
    }

    // 3. Event Configuration (if event has default filter)
    if (opts.eventId) {
      effective.parameters.event = opts.eventId;
      effective.precedenceLevel = 'EVENT_CONFIGURATION';
    }

    // 4. User Personal View / Selected Saved View
    if (opts.savedViewId) {
      const view = await prisma.report_saved_views.findFirst({
        where: {
          id: opts.savedViewId,
          organization_id: opts.organizationId,
          is_active: true,
          OR: [{ user_id: opts.userId }, { is_shared: true }],
        },
      });
      if (view) {
        effective.parameters = { ...effective.parameters, ...(view.parameters as Record<string, any>) };
        if (view.selected_sections && (view.selected_sections as string[]).length > 0) {
          effective.selectedSections = view.selected_sections as string[];
        }
        if (view.layout_id) effective.layoutId = view.layout_id;
        if (view.output_format) effective.outputFormat = view.output_format;
        effective.precedenceLevel = 'USER_PERSONAL_VIEW';
      }
    }

    return effective;
  }
}
