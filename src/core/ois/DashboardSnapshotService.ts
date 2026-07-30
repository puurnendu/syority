/**
 * M7.6C — Dashboard Snapshot Service
 *
 * Generates dashboard snapshots for export and delivery.
 * Reuses ArtifactService storage pattern and BrandingService for theming.
 * Does NOT create a new export engine — delegates rendering to existing services.
 */

import { prisma } from '@/lib/prisma';
import { BrandingService, type ResolvedBranding } from '@/core/report-engine/BrandingService';
import { WidgetDataService } from './WidgetDataService';
import type { ExportFormat } from './WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SnapshotOptions {
  dashboardId: string;
  organizationId: string;
  outputFormat: ExportFormat;
  generatedBy: string;
  brandingProfileId?: string;
  retentionDays?: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class DashboardSnapshotService {

  /**
   * Generate a snapshot of a dashboard.
   * Fetches all widget data, renders to HTML, stores as artifact.
   */
  static async generate(opts: SnapshotOptions) {
    // 1. Load dashboard with widgets
    const dashboard = await prisma.ois_dashboard_definitions.findUniqueOrThrow({
      where: { id: opts.dashboardId },
      include: {
        pages: {
          orderBy: { sort_order: 'asc' },
          include: {
            widgets: {
              where: { is_visible: true },
              orderBy: { sort_order: 'asc' },
              include: { widget_definition: true },
            },
          },
        },
        widgets: {
          where: { is_visible: true },
          orderBy: { sort_order: 'asc' },
          include: { widget_definition: true },
        },
      },
    });

    // 2. Resolve branding
    const branding = await BrandingService.resolve(
      opts.organizationId,
      opts.brandingProfileId ?? dashboard.branding_profile_id ?? undefined,
    );

    // 3. Fetch all widget data (batch — deduplicated)
    const widgetFetchList = dashboard.widgets.map((w) => ({
      id: w.id,
      providerKey: w.widget_definition.provider_key,
      params: (w.provider_params as Record<string, any>) ?? {},
    }));
    const dataMap = await WidgetDataService.batchFetch({
      widgets: widgetFetchList,
      organizationId: opts.organizationId,
      skipCache: true, // Fresh data for snapshots
    });

    // 4. Render to HTML
    const htmlContent = DashboardSnapshotService.renderHtml(
      dashboard,
      dataMap,
      branding,
    );

    // 5. Store snapshot
    const now = new Date();
    const filename = `${dashboard.slug}_${now.toISOString().split('T')[0]}.${opts.outputFormat}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (opts.retentionDays ?? 90));

    const snapshot = await prisma.ois_dashboard_snapshots.create({
      data: {
        dashboard_id: opts.dashboardId,
        organization_id: opts.organizationId,
        output_format: opts.outputFormat,
        filename,
        content_type: DashboardSnapshotService.getContentType(opts.outputFormat),
        file_size_bytes: Buffer.byteLength(htmlContent, 'utf-8'),
        html_snapshot: htmlContent,
        page_count: dashboard.pages.length || 1,
        generated_by: opts.generatedBy,
        expires_at: expiresAt,
      },
    });

    return {
      snapshotId: snapshot.id,
      filename,
      htmlContent,
      pageCount: dashboard.pages.length || 1,
    };
  }

  /**
   * List snapshots for a dashboard.
   */
  static async list(dashboardId: string, opts?: { page?: number; pageSize?: number }) {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 10;

    return prisma.ois_dashboard_snapshots.findMany({
      where: { dashboard_id: dashboardId },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        output_format: true,
        filename: true,
        file_size_bytes: true,
        page_count: true,
        generated_by: true,
        created_at: true,
      },
    });
  }

  /**
   * Get snapshot by ID (with content).
   */
  static async getById(id: string) {
    return prisma.ois_dashboard_snapshots.findUniqueOrThrow({ where: { id } });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private static renderHtml(
    dashboard: any,
    dataMap: Map<string, any>,
    branding: ResolvedBranding,
  ): string {
    const headerBg = branding.primaryColor;
    const accentColor = branding.accentColor;
    const fontFamily = branding.fontFamily;
    const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

    // Render widget sections
    const widgetHtmlSections = dashboard.widgets.map((w: any) => {
      const data = dataMap.get(w.id);
      const title = w.title_override || w.widget_definition.name;
      const icon = w.icon_override || w.widget_definition.icon || '📊';

      let contentHtml = '<p style="color:#9CA3AF;font-style:italic;">No data</p>';

      if (data) {
        // KPI cards
        if (data.kpis?.length) {
          contentHtml = `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;">${
            data.kpis.map((k: any) =>
              `<div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;min-width:120px;flex:1;">
                <div style="font-size:11px;color:#6B7280;text-transform:uppercase;">${k.label}</div>
                <div style="font-size:24px;font-weight:700;color:${k.color ?? branding.textColor};">${k.value}${k.unit ? ` <span style="font-size:12px;font-weight:400;">${k.unit}</span>` : ''}</div>
              </div>`
            ).join('')
          }</div>`;
        }

        // Table data
        if (data.rows?.length) {
          const cols = Object.keys(data.rows[0]);
          const headerRow = cols.map((c: string) =>
            `<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#374151;background:#F3F4F6;border-bottom:2px solid #E5E7EB;">${c.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())}</th>`
          ).join('');
          const dataRows = data.rows.slice(0, 50).map((row: any, i: number) => {
            const bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
            return `<tr style="background:${bg};">${cols.map((c: string) =>
              `<td style="padding:6px 12px;font-size:12px;color:#374151;border-bottom:1px solid #E5E7EB;">${row[c] ?? '—'}</td>`
            ).join('')}</tr>`;
          }).join('');
          contentHtml += `<table style="width:100%;border-collapse:collapse;"><thead><tr>${headerRow}</tr></thead><tbody>${dataRows}</tbody></table>`;
        }
      }

      return `<div style="background:#FFFFFF;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:20px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">${icon}</span>
          <h3 style="margin:0;font-size:16px;font-weight:600;color:${branding.textColor};">${title}</h3>
          ${w.subtitle ? `<span style="font-size:12px;color:#9CA3AF;">— ${w.subtitle}</span>` : ''}
        </div>
        ${contentHtml}
      </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dashboard.name} — Snapshot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${fontFamily}; background: #F3F4F6; color: ${branding.textColor}; }
    @media print { body { background: #FFF; } }
  </style>
</head>
<body>
  <header style="background:${headerBg};color:#FFF;padding:24px 32px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="height:${branding.logoHeightPx}px;margin-bottom:8px;">` : ''}
      <h1 style="font-size:24px;font-weight:700;">${dashboard.name}</h1>
      ${dashboard.description ? `<p style="font-size:13px;opacity:0.8;">${dashboard.description}</p>` : ''}
    </div>
    <div style="text-align:right;font-size:12px;opacity:0.7;">
      <div>Generated: ${now}</div>
      <div>${branding.orgName}</div>
      <div>${branding.confidentiality}</div>
    </div>
  </header>
  <main style="max-width:1200px;margin:0 auto;padding:24px 32px;">
    ${widgetHtmlSections}
  </main>
  <footer style="text-align:center;padding:16px;font-size:11px;color:#9CA3AF;">
    ${branding.disclaimerText ?? `© ${new Date().getFullYear()} ${branding.orgName}. ${branding.confidentiality}.`}
  </footer>
</body>
</html>`;
  }

  private static getContentType(format: ExportFormat): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      html: 'text/html',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      png: 'image/png',
    };
    return map[format] ?? 'application/octet-stream';
  }
}
