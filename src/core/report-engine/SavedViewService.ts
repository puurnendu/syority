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
      userId: data.userId,
      organizationId: data.organizationId,
      action: 'CREATE',
      modelName: 'report_saved_views',
      modelId: view.id,
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
      userId,
      organizationId: existing.organization_id,
      action: 'UPDATE',
      modelName: 'report_saved_views',
      modelId: id,
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
      userId,
      organizationId: existing.organization_id,
      action: 'DELETE',
      modelName: 'report_saved_views',
      modelId: id,
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
}
