/**
 * M7.6B — Branding Service
 *
 * Manages branding profiles and resolves the branding chain:
 *   Layout → Branding Profile → Organization settings → Platform defaults.
 */

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResolvedBranding {
  /** Profile used (if any) */
  profileId?: string;
  profileName?: string;
  /** Visual identity */
  logoUrl?: string;
  logoWidthPx: number;
  logoHeightPx: number;
  /** Company info */
  orgName: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  /** Header / Footer */
  headerHtml?: string;
  footerHtml?: string;
  /** Theme */
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  /** Typography */
  fontFamily: string;
  headingFont: string;
  fontSizeBase: number;
  /** Signatures */
  signatureBlock: boolean;
  signatureLabels: string[];
  /** Legal */
  disclaimerText?: string;
  confidentiality: string;
}

const PLATFORM_DEFAULTS: ResolvedBranding = {
  logoWidthPx: 180,
  logoHeightPx: 50,
  orgName: 'SYORITY',
  primaryColor: '#0D2137',
  secondaryColor: '#1E3A5F',
  accentColor: '#E8701A',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily: 'Inter, Arial, sans-serif',
  headingFont: 'Inter, Arial, sans-serif',
  fontSizeBase: 12,
  signatureBlock: false,
  signatureLabels: [],
  confidentiality: 'CONFIDENTIAL',
};

// ─── Service ────────────────────────────────────────────────────────────────

export class BrandingService {
  // ── CRUD ────────────────────────────────────────────────────────────────

  static async list(organizationId: string, includeInactive = false) {
    return prisma.report_branding_profiles.findMany({
      where: { organization_id: organizationId, ...(includeInactive ? {} : { is_active: true }) },
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
  }

  static async getById(id: string) {
    return prisma.report_branding_profiles.findUniqueOrThrow({ where: { id } });
  }

  static async create(data: Record<string, any>, userId?: string) {
    // If marking as default, clear existing defaults first
    if (data.is_default) {
      await prisma.report_branding_profiles.updateMany({
        where: { organization_id: data.organization_id, is_default: true },
        data: { is_default: false },
      });
    }

    const profile = await prisma.report_branding_profiles.create({
      data: {
        organization_id: data.organization_id,
        name: data.name,
        slug: data.slug ?? data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: data.description,
        logo_url: data.logo_url,
        logo_width_px: data.logo_width_px,
        logo_height_px: data.logo_height_px,
        header_html: data.header_html,
        footer_html: data.footer_html,
        company_name: data.company_name,
        company_address: data.company_address,
        company_phone: data.company_phone,
        company_email: data.company_email,
        company_website: data.company_website,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        accent_color: data.accent_color,
        background_color: data.background_color,
        text_color: data.text_color,
        font_family: data.font_family,
        heading_font: data.heading_font,
        font_size_base: data.font_size_base,
        signature_block: data.signature_block ?? false,
        signature_labels: data.signature_labels,
        disclaimer_text: data.disclaimer_text,
        confidentiality: data.confidentiality,
        is_default: data.is_default ?? false,
        created_by: userId,
      },
    });

    if (userId) {
      await AuditService.log({
        userId,
        organizationId: data.organization_id,
        action: 'CREATE',
        modelName: 'report_branding_profiles',
        modelId: profile.id,
      }).catch(() => {});
    }

    return profile;
  }

  static async update(id: string, data: Record<string, any>, userId?: string) {
    const existing = await prisma.report_branding_profiles.findUniqueOrThrow({ where: { id } });

    // If marking as default, clear existing defaults first
    if (data.is_default && !existing.is_default) {
      await prisma.report_branding_profiles.updateMany({
        where: { organization_id: existing.organization_id, is_default: true },
        data: { is_default: false },
      });
    }

    const updated = await prisma.report_branding_profiles.update({
      where: { id },
      data: { ...data, updated_by: userId },
    });

    if (userId) {
      await AuditService.log({
        userId,
        organizationId: existing.organization_id,
        action: 'UPDATE',
        modelName: 'report_branding_profiles',
        modelId: id,
      }).catch(() => {});
    }

    return updated;
  }

  static async delete(id: string, userId?: string) {
    const existing = await prisma.report_branding_profiles.findUniqueOrThrow({ where: { id } });
    const deleted = await prisma.report_branding_profiles.delete({ where: { id } });

    if (userId) {
      await AuditService.log({
        userId,
        organizationId: existing.organization_id,
        action: 'DELETE',
        modelName: 'report_branding_profiles',
        modelId: id,
      }).catch(() => {});
    }

    return deleted;
  }

  // ── Resolution Chain ────────────────────────────────────────────────────

  /**
   * Resolve branding for a report.
   * Chain: Layout → Branding Profile → Organization → Platform Defaults.
   */
  static async resolve(opts: {
    layoutId?: string | null;
    brandingProfileId?: string | null;
    organizationId: string;
  }): Promise<ResolvedBranding> {
    const result = { ...PLATFORM_DEFAULTS };

    // 1. Organization defaults
    const org = await prisma.organization.findUnique({
      where: { id: opts.organizationId },
      select: {
        name: true, logo_url: true, logo_width_px: true, logo_height_px: true,
        primary_color: true, platform_name: true,
      },
    });
    if (org) {
      result.orgName = org.name;
      if (org.logo_url) { result.logoUrl = org.logo_url; }
      if (org.logo_width_px) { result.logoWidthPx = org.logo_width_px; }
      if (org.logo_height_px) { result.logoHeightPx = org.logo_height_px; }
      if (org.primary_color) { result.primaryColor = org.primary_color; }
    }

    // 2. Branding profile (if specified, or find org default)
    let profile: any = null;
    if (opts.brandingProfileId) {
      profile = await prisma.report_branding_profiles.findUnique({ where: { id: opts.brandingProfileId } });
    } else {
      profile = await prisma.report_branding_profiles.findFirst({
        where: { organization_id: opts.organizationId, is_default: true, is_active: true },
      });
    }

    if (profile) {
      result.profileId = profile.id;
      result.profileName = profile.name;
      if (profile.logo_url) { result.logoUrl = profile.logo_url; }
      if (profile.logo_width_px) { result.logoWidthPx = profile.logo_width_px; }
      if (profile.logo_height_px) { result.logoHeightPx = profile.logo_height_px; }
      if (profile.header_html) { result.headerHtml = profile.header_html; }
      if (profile.footer_html) { result.footerHtml = profile.footer_html; }
      if (profile.company_name) { result.companyName = profile.company_name; }
      if (profile.company_address) { result.companyAddress = profile.company_address; }
      if (profile.company_phone) { result.companyPhone = profile.company_phone; }
      if (profile.company_email) { result.companyEmail = profile.company_email; }
      if (profile.company_website) { result.companyWebsite = profile.company_website; }
      if (profile.primary_color) { result.primaryColor = profile.primary_color; }
      if (profile.secondary_color) { result.secondaryColor = profile.secondary_color; }
      if (profile.accent_color) { result.accentColor = profile.accent_color; }
      if (profile.background_color) { result.backgroundColor = profile.background_color; }
      if (profile.text_color) { result.textColor = profile.text_color; }
      if (profile.font_family) { result.fontFamily = profile.font_family; }
      if (profile.heading_font) { result.headingFont = profile.heading_font; }
      if (profile.font_size_base) { result.fontSizeBase = profile.font_size_base; }
      result.signatureBlock = profile.signature_block;
      if (profile.signature_labels) { result.signatureLabels = profile.signature_labels as string[]; }
      if (profile.disclaimer_text) { result.disclaimerText = profile.disclaimer_text; }
      if (profile.confidentiality) { result.confidentiality = profile.confidentiality; }
    }

    // 3. Layout overrides (header/footer/colors from layout take highest priority)
    if (opts.layoutId) {
      const layout = await prisma.report_layouts.findUnique({ where: { id: opts.layoutId } });
      if (layout) {
        if (layout.logo_url) { result.logoUrl = layout.logo_url; }
        if (layout.header_html) { result.headerHtml = layout.header_html; }
        if (layout.footer_html) { result.footerHtml = layout.footer_html; }
        if (layout.primary_color) { result.primaryColor = layout.primary_color; }
        if (layout.accent_color) { result.accentColor = layout.accent_color; }
        if (layout.font_family) { result.fontFamily = layout.font_family; }
        if (layout.font_size_base) { result.fontSizeBase = layout.font_size_base; }
        result.signatureBlock = layout.show_signature;
        if (layout.signature_labels) { result.signatureLabels = layout.signature_labels as string[]; }
      }
    }

    return result;
  }
}
