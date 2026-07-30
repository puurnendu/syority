/**
 * M7.6A — Report Definition Service
 *
 * CRUD for report definitions, categories, and sections.
 */

import { prisma } from '@/lib/prisma';

// ─── Categories ─────────────────────────────────────────────────────────────

export class ReportCategoryService {
  static async list() {
    return prisma.report_categories.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      include: {
        definitions: {
          where: { is_active: true },
          select: { id: true, slug: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  static async getBySlug(slug: string) {
    return prisma.report_categories.findUnique({ where: { slug } });
  }
}

// ─── Definitions ────────────────────────────────────────────────────────────

export class ReportDefinitionService {
  /**
   * List report definitions visible to a tenant.
   * System (org=null) definitions + org-specific definitions are included.
   */
  static async list(organizationId: string, categorySlug?: string) {
    const categoryFilter = categorySlug
      ? { category: { slug: categorySlug } }
      : {};

    return prisma.report_definitions.findMany({
      where: {
        is_active: true,
        OR: [
          { organization_id: null },              // platform-wide
          { organization_id: organizationId },    // org-specific
        ],
        ...categoryFilter,
      },
      orderBy: [{ category: { sort_order: 'asc' } }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
        parameters: {
          include: { parameter: true },
          orderBy: { sort_order: 'asc' },
        },
        sections: {
          orderBy: { sort_order: 'asc' },
        },
        _count: { select: { generations: true, schedules: true } },
      },
    });
  }

  /**
   * Get a single definition by ID with full details.
   */
  static async getById(id: string) {
    return prisma.report_definitions.findUnique({
      where: { id },
      include: {
        category: true,
        default_layout: true,
        parameters: {
          include: { parameter: true },
          orderBy: { sort_order: 'asc' },
        },
        sections: {
          orderBy: { sort_order: 'asc' },
        },
      },
    });
  }

  /**
   * Get a definition by slug.
   */
  static async getBySlug(slug: string) {
    return prisma.report_definitions.findUnique({
      where: { slug },
      include: {
        category: true,
        default_layout: true,
        parameters: {
          include: { parameter: true },
          orderBy: { sort_order: 'asc' },
        },
        sections: {
          orderBy: { sort_order: 'asc' },
        },
      },
    });
  }

  /**
   * Create a new report definition (platform admin only).
   */
  static async create(data: {
    category_id: string;
    slug: string;
    name: string;
    description?: string;
    data_source_key: string;
    default_output?: string;
    supports_outputs?: string[];
    subject_template?: string;
    filename_template?: string;
    supports_ai_summary?: boolean;
    ai_prompt_template?: string;
    is_system?: boolean;
    organization_id?: string;
    default_layout_id?: string;
    created_by?: string;
  }) {
    return prisma.report_definitions.create({
      data: {
        category_id: data.category_id,
        slug: data.slug,
        name: data.name,
        description: data.description,
        data_source_key: data.data_source_key,
        default_output: data.default_output ?? 'pdf',
        supports_outputs: data.supports_outputs ?? ['html', 'pdf', 'excel', 'csv'],
        subject_template: data.subject_template,
        filename_template: data.filename_template,
        supports_ai_summary: data.supports_ai_summary ?? false,
        ai_prompt_template: data.ai_prompt_template,
        is_system: data.is_system ?? false,
        organization_id: data.organization_id ?? null,
        default_layout_id: data.default_layout_id ?? null,
        created_by: data.created_by,
      },
      include: { category: true },
    });
  }

  /**
   * Update a report definition.
   */
  static async update(id: string, data: Record<string, any>, updatedBy?: string) {
    const { category_id, sections, parameters, ...rest } = data;
    return prisma.report_definitions.update({
      where: { id },
      data: {
        ...rest,
        ...(category_id ? { category_id } : {}),
        updated_by: updatedBy,
      },
      include: { category: true },
    });
  }

  /**
   * Soft-delete by deactivating.
   */
  static async delete(id: string) {
    // Don't allow deletion of system reports
    const def = await prisma.report_definitions.findUnique({ where: { id } });
    if (def?.is_system) {
      throw new Error('Cannot delete system report definitions');
    }
    return prisma.report_definitions.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Add a section to a definition.
   */
  static async addSection(definitionId: string, data: {
    key: string;
    name: string;
    description?: string;
    section_type?: string;
    chart_type?: string;
    chart_config?: any;
    data_source_key?: string;
    sort_order?: number;
    is_default?: boolean;
    is_required?: boolean;
  }) {
    return prisma.report_sections.create({
      data: {
        definition_id: definitionId,
        ...data,
      },
    });
  }

  /**
   * Link a parameter to a definition.
   */
  static async addParameter(definitionId: string, parameterId: string, opts?: {
    is_required?: boolean;
    sort_order?: number;
  }) {
    return prisma.report_definition_parameters.create({
      data: {
        definition_id: definitionId,
        parameter_id: parameterId,
        is_required: opts?.is_required ?? false,
        sort_order: opts?.sort_order ?? 0,
      },
    });
  }

  /**
   * List all definitions for platform admin (including inactive).
   */
  static async listAll() {
    return prisma.report_definitions.findMany({
      orderBy: [{ category: { sort_order: 'asc' } }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
        _count: { select: { parameters: true, sections: true, generations: true, schedules: true } },
      },
    });
  }
}
