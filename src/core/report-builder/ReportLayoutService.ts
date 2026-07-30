/**
 * M7.6A — Report Layout Service
 *
 * CRUD for report layouts with branding resolution.
 */

import { prisma } from '@/lib/prisma';

export class ReportLayoutService {
  /**
   * List layouts visible to an organization.
   */
  static async list(organizationId?: string) {
    return prisma.report_layouts.findMany({
      where: {
        is_active: true,
        OR: [
          { organization_id: null },
          ...(organizationId ? [{ organization_id: organizationId }] : []),
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a single layout by ID.
   */
  static async getById(id: string) {
    return prisma.report_layouts.findUnique({ where: { id } });
  }

  /**
   * Get the default layout, falling back to system layout.
   */
  static async getDefault(organizationId?: string) {
    // Try org-specific first
    if (organizationId) {
      const orgLayout = await prisma.report_layouts.findFirst({
        where: { organization_id: organizationId, is_active: true },
        orderBy: { created_at: 'asc' },
      });
      if (orgLayout) return orgLayout;
    }
    // Fall back to system
    return prisma.report_layouts.findFirst({
      where: { is_system: true, is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * Create a new layout.
   */
  static async create(data: {
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
    header_html?: string;
    footer_html?: string;
    page_size?: string;
    orientation?: string;
    margin_top?: number;
    margin_bottom?: number;
    margin_left?: number;
    margin_right?: number;
    font_family?: string;
    font_size_base?: number;
    show_signature?: boolean;
    signature_labels?: string[];
    is_system?: boolean;
    organization_id?: string;
    created_by?: string;
  }) {
    return prisma.report_layouts.create({ data });
  }

  /**
   * Update a layout.
   */
  static async update(id: string, data: Record<string, any>, updatedBy?: string) {
    return prisma.report_layouts.update({
      where: { id },
      data: { ...data, updated_by: updatedBy },
    });
  }

  /**
   * Soft-delete.
   */
  static async delete(id: string) {
    const layout = await prisma.report_layouts.findUnique({ where: { id } });
    if (layout?.is_system) throw new Error('Cannot delete system layouts');
    return prisma.report_layouts.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Resolve branding for a layout, merging with org settings.
   */
  static async resolveBranding(layoutId: string | null, organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, logo_url: true, primary_color: true },
    });

    const layout = layoutId
      ? await prisma.report_layouts.findUnique({ where: { id: layoutId } })
      : await ReportLayoutService.getDefault(organizationId);

    return {
      orgName: org?.name ?? 'AURIANOA OS',
      logoUrl: layout?.logo_url ?? org?.logo_url ?? null,
      primaryColor: layout?.primary_color ?? org?.primary_color ?? '#0D2137',
      accentColor: layout?.accent_color ?? '#E8701A',
      headerHtml: layout?.header_html ?? null,
      footerHtml: layout?.footer_html ?? `<div style="font-size:10px;color:#9CA3AF;text-align:center;padding:8px 0;border-top:1px solid #E5E7EB;">{{orgName}} — Generated {{date}} — Page {{page}} of {{total_pages}}</div>`,
      pageSize: layout?.page_size ?? 'A4',
      orientation: layout?.orientation ?? 'portrait',
      margins: {
        top: layout?.margin_top ?? 20,
        bottom: layout?.margin_bottom ?? 20,
        left: layout?.margin_left ?? 15,
        right: layout?.margin_right ?? 15,
      },
      fontFamily: layout?.font_family ?? 'Inter, Arial, sans-serif',
      fontSizeBase: layout?.font_size_base ?? 12,
      showSignature: layout?.show_signature ?? false,
      signatureLabels: (layout?.signature_labels as string[]) ?? [],
    };
  }
}
