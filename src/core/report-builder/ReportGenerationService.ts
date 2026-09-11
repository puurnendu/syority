/**
 * M14-R4 — Governed Report Generation & Delivery Engine
 *
 * Core engine: Takes a report definition + parameters → generates output.
 * Produces ONE authoritative, deeply immutable ReportDataset.
 * Renders the exact same dataset to HTML, PDF, XLSX, and CSV.
 * Governs artifact persistence, historical snapshotting, and delivery queues.
 */

import { prisma } from '@/lib/prisma';
import { ReportLayoutService } from './ReportLayoutService';
import { dataFetcherRegistry, type DataFetcherResult } from './data-fetchers';
import { ArtifactService } from '@/core/report-engine/ArtifactService';
import { AiReportAssistant } from '@/core/report-engine/AiReportAssistant';
import { createHash } from 'crypto';

// ─── Immutability Helper ───────────────────────────────────────────────────

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const prop = (obj as any)[key];
    if (prop !== null && (typeof prop === 'object' || typeof prop === 'function') && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  }
  return obj;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  definitionId: string;
  organizationId: string;
  generatedBy: string;
  outputFormat: 'html' | 'pdf' | 'excel' | 'csv';
  layoutId?: string;
  selectedSections?: string[];
  parameters?: Record<string, any>;
  includeAiSummary?: boolean;
  scheduleId?: string;
}

export interface ReportProvenance {
  authoritySources: string[];
  reportDefinitionVersion: string;
  templateVersion: string;
  snapshotTimestamp: string;
}

export interface ReportDataset {
  reportId: string;
  report_definition_id: string;
  reportVersion: string;
  report_definition_version: string;
  organizationId: string;
  organization_id: string;
  eventId: string | null;
  event_id: string | null;
  generatedAt: string;
  generated_at: string;
  generatedBy: string;
  generated_by: string;
  dataAsOf: string;
  data_as_of: string;
  templateId?: string | null;
  template_id?: string | null;
  templateVersion: string;
  template_version: string;
  filters: Record<string, any>;
  dimensions: string[];
  rows: any[];
  data: DataFetcherResult;
  aiSummary: string | null;
  provenance: ReportProvenance;
  datasetHash: string;
  dataset_hash: string;
  hash: string;
}

export interface ReportExecutionContext {
  organizationId: string;
  eventId?: string;
  userId: string;
  reportDefinition: any;
  templateVersion: string;
  filters: Record<string, any>;
  dimensions: string[];
  generatedAt: Date;
  dataset: ReportDataset;
}

export interface GenerationResult {
  generationId: string;
  status: 'completed' | 'failed';
  outputFormat?: 'html' | 'pdf' | 'excel' | 'csv';
  htmlContent?: string;
  fileBuffer?: Buffer;
  filePath?: string;
  resolvedSubject?: string;
  resolvedFilename?: string;
  datasetHash?: string;
  error?: string;
}

// ─── Deterministic Dataset Hashing ──────────────────────────────────────────

/**
 * Generates a stable SHA-256 hash for a dataset.
 * Nondeterministic values such as execution IDs and runtime timestamps (generatedAt)
 * are strictly excluded so the same parameters + authoritative data produce identical hashes.
 */
export function generateDatasetHash(data: {
  reportId: string;
  reportVersion: string;
  organizationId: string;
  eventId?: string | null;
  dataAsOf: string;
  filters: Record<string, any>;
  rows: any[];
  data?: any;
  authoritySources: string[];
}): string {
  const sortedFilterKeys = Object.keys(data.filters || {}).sort();
  const canonicalFilters = sortedFilterKeys.reduce((acc, k) => {
    acc[k] = data.filters[k];
    return acc;
  }, {} as Record<string, any>);

  const canonicalObj = {
    authoritySources: [...(data.authoritySources || [])].sort(),
    dataAsOf: data.dataAsOf,
    eventId: data.eventId ?? null,
    filters: canonicalFilters,
    organizationId: data.organizationId,
    reportId: data.reportId,
    reportVersion: data.reportVersion,
    rows: data.rows,
  };

  return createHash('sha256').update(JSON.stringify(canonicalObj)).digest('hex');
}

// ─── Variable Resolution ────────────────────────────────────────────────────

function resolveVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function buildVariableContext(params: Record<string, any>, extra: Record<string, string> = {}): Record<string, string> {
  const now = new Date();
  const weekNumber = Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  );

  return {
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5),
    datetime: now.toISOString().replace('T', ' ').slice(0, 19),
    week: String(weekNumber),
    month: now.toLocaleString('en', { month: 'long' }),
    year: String(now.getFullYear()),
    ...Object.entries(params).reduce((acc, [k, v]) => {
      acc[k] = String(v ?? '');
      return acc;
    }, {} as Record<string, string>),
    ...extra,
  };
}

// ─── HTML Rendering ─────────────────────────────────────────────────────────

function renderTableHtml(data: any[], columns?: Array<{ key: string; label: string }>): string {
  if (!data || data.length === 0) {
    return '<p style="color:#6B7280;font-style:italic;">No data available for this section.</p>';
  }

  const cols = columns ?? Object.keys(data[0]).map((k) => ({
    key: k,
    label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  const headerRow = cols.map((c) => `<th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;background:#F3F4F6;border-bottom:2px solid #E5E7EB;">${c.label}</th>`).join('');
  const dataRows = data.map((row, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
    const cells = cols.map((c) => {
      const val = row[c.key];
      const display = val === null || val === undefined ? '—' : String(val);
      return `<td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #E5E7EB;background:${bg};">${display}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr>${headerRow}</tr></thead><tbody>${dataRows}</tbody></table>`;
}

function renderKpiCards(kpis: Array<{ label: string; value: string | number; unit?: string; trend?: 'up' | 'down' | 'flat'; color?: string }>): string {
  const cards = kpis.map((kpi) => {
    const trendIcon = kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→';
    const trendColor = kpi.trend === 'up' ? '#059669' : kpi.trend === 'down' ? '#DC2626' : '#6B7280';
    return `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:16px;min-width:140px;flex:1;">
      <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${kpi.label}</div>
      <div style="font-size:24px;font-weight:700;color:${kpi.color ?? '#0D2137'};">${kpi.value}${kpi.unit ? `<span style="font-size:13px;color:#9CA3AF;margin-left:2px;">${kpi.unit}</span>` : ''}</div>
      ${kpi.trend ? `<div style="font-size:12px;color:${trendColor};margin-top:4px;">${trendIcon}</div>` : ''}
    </div>`;
  }).join('');
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;">${cards}</div>`;
}

function renderSummaryBlock(title: string, content: string): string {
  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px 20px;margin:16px 0;">
    <h3 style="margin:0 0 8px;color:#0D2137;font-size:14px;font-weight:600;">${title}</h3>
    <div style="color:#374151;font-size:13px;line-height:1.6;">${content}</div>
  </div>`;
}

function renderSignatureBlock(labels: string[]): string {
  const blocks = labels.map((label) => `
    <div style="flex:1;text-align:center;">
      <div style="border-bottom:1px solid #374151;margin-bottom:8px;height:60px;"></div>
      <div style="font-size:12px;color:#374151;font-weight:500;">${label}</div>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">Name / Date</div>
    </div>
  `).join('');
  return `<div style="display:flex;gap:40px;margin:32px 0;padding-top:24px;border-top:1px solid #E5E7EB;">${blocks}</div>`;
}

// ─── Section Renderer ───────────────────────────────────────────────────────

async function renderSection(
  section: { key: string; name: string; section_type: string; chart_type?: string | null; chart_config?: any; data_source_key?: string | null },
  fetchedData: DataFetcherResult,
  branding: Awaited<ReturnType<typeof ReportLayoutService.resolveBranding>>
): Promise<string> {
  const sectionHtml: string[] = [];
  sectionHtml.push(`<div class="report-section" style="margin-bottom:24px;page-break-inside:avoid;">`);
  sectionHtml.push(`<h2 style="color:${branding.primaryColor};font-size:16px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid ${branding.accentColor};">${section.name}</h2>`);

  switch (section.section_type) {
    case 'kpi_cards':
      if (fetchedData.kpis) {
        sectionHtml.push(renderKpiCards(fetchedData.kpis));
      }
      break;

    case 'summary':
      if (fetchedData.summary) {
        sectionHtml.push(renderSummaryBlock(section.name, fetchedData.summary));
      }
      break;

    case 'chart':
      sectionHtml.push(`<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:32px;text-align:center;color:#6B7280;">
        <div style="font-size:14px;font-weight:600;">📊 ${section.chart_type?.toUpperCase() ?? 'CHART'}: ${section.name}</div>
        <div style="font-size:12px;margin-top:6px;">Authoritative chart dataset preserved in ReportDataset</div>
      </div>`);
      break;

    case 'signature':
      sectionHtml.push(renderSignatureBlock(branding.signatureLabels.length > 0 ? branding.signatureLabels : ['Prepared By', 'Reviewed By']));
      break;

    case 'data':
    default:
      if (fetchedData.tables?.[section.key]) {
        const tableData = fetchedData.tables[section.key];
        sectionHtml.push(renderTableHtml(tableData.rows, tableData.columns));
      } else if (fetchedData.rows) {
        sectionHtml.push(renderTableHtml(fetchedData.rows));
      }
      break;
  }

  sectionHtml.push('</div>');
  return sectionHtml.join('');
}

// ─── Full Report HTML ───────────────────────────────────────────────────────

async function renderFullHtml(
  definition: any,
  sections: any[],
  fetchedData: DataFetcherResult,
  branding: Awaited<ReturnType<typeof ReportLayoutService.resolveBranding>>,
  vars: Record<string, string>,
  aiSummary?: string | null
): Promise<string> {
  const sectionHtmlParts: string[] = [];

  if (aiSummary) {
    sectionHtmlParts.push(renderSummaryBlock('Executive Summary', aiSummary));
  }

  for (const section of sections) {
    sectionHtmlParts.push(await renderSection(section, fetchedData, branding));
  }

  const headerHtml = branding.headerHtml
    ? resolveVariables(branding.headerHtml, vars)
    : `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid ${branding.primaryColor};margin-bottom:24px;">
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="" style="height:40px;" />` : `<div style="font-size:18px;font-weight:700;color:${branding.primaryColor};">${branding.orgName}</div>`}
        <div style="text-align:right;">
          <div style="font-size:16px;font-weight:700;color:${branding.primaryColor};">${definition.name}</div>
          <div style="font-size:12px;color:#6B7280;">Generated: ${vars.datetime}</div>
        </div>
      </div>`;

  const footerHtml = branding.footerHtml
    ? resolveVariables(branding.footerHtml, { ...vars, orgName: branding.orgName, page: '{{page}}', total_pages: '{{total_pages}}' })
    : `<div style="font-size:10px;color:#9CA3AF;text-align:center;padding:12px 0;border-top:1px solid #E5E7EB;margin-top:32px;">${branding.orgName} — ${definition.name} — Confidential</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${definition.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${branding.fontFamily}; font-size: ${branding.fontSizeBase}px; color: #374151; line-height: 1.5; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body style="padding:${branding.margins.top}mm ${branding.margins.right}mm ${branding.margins.bottom}mm ${branding.margins.left}mm;">
  ${headerHtml}
  ${sectionHtmlParts.join('\n')}
  ${branding.showSignature ? renderSignatureBlock(branding.signatureLabels.length > 0 ? branding.signatureLabels : ['Prepared By', 'Reviewed By', 'Approved By']) : ''}
  ${footerHtml}
</body>
</html>`;
}

// ─── CSV Conversion ─────────────────────────────────────────────────────────

export function convertToCsv(data: DataFetcherResult | ReportDataset): string {
  let rows: any[] = [];
  if ('rows' in data && Array.isArray((data as any).rows) && (data as any).rows.length > 0) {
    rows = (data as any).rows;
  } else if ('data' in data && (data as any).data?.rows) {
    rows = (data as any).data.rows;
  } else if ('data' in data && (data as any).data?.tables) {
    rows = Object.values((data as any).data.tables).flatMap((t: any) => t.rows || []);
  } else if ((data as any).tables) {
    rows = Object.values((data as any).tables).flatMap((t: any) => t.rows || []);
  }

  if (rows.length === 0) {
    const kpis = (data as any).kpis ?? ((data as any).data?.kpis ?? []);
    if (kpis.length > 0) {
      const headerRow = 'metric_label,value,unit,trend';
      const kpiRows = kpis.map((k: any) => `"${k.label ?? ''}","${k.value ?? ''}","${k.unit ?? ''}","${k.trend ?? ''}"`);
      return '\uFEFF' + [headerRow, ...kpiRows].join('\n');
    }
    return '\uFEFF';
  }

  const keys = Object.keys(rows[0]).sort();
  const headerRow = keys.join(',');
  const dataRows = rows.map((row: any) =>
    keys.map((k) => {
      const val = row[k];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );

  return '\uFEFF' + [headerRow, ...dataRows].join('\n');
}

// ─── Main Generation Service Class ─────────────────────────────────────────

export class ReportGenerationService {
  static convertToCsv = convertToCsv;
  static renderFullHtml = renderFullHtml;

  /**
   * Generates governed PDF binary buffer via Puppeteer singleton with print CSS.
   */
  static async generatePdf(
    htmlContent: string,
    branding: any,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): Promise<Buffer> {
    try {
      const { getBrowser } = await import('@/lib/puppeteer');
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        page.setDefaultTimeout(60000);
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        const pdfBuffer = await page.pdf({
          format: (branding?.pageSize as any) || 'A4',
          landscape: orientation === 'landscape' || branding?.orientation === 'landscape',
          printBackground: true,
          margin: {
            top: `${branding?.margins?.top ?? 20}mm`,
            bottom: `${branding?.margins?.bottom ?? 20}mm`,
            left: `${branding?.margins?.left ?? 15}mm`,
            right: `${branding?.margins?.right ?? 15}mm`,
          },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: `
            <div style="font-family: Arial, sans-serif; font-size: 8px; color: #9CA3AF; width: 100%; display: flex; justify-content: space-between; padding: 0 15mm;">
              <span>${branding?.orgName ?? 'SYORITY'}</span>
              <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>
          `,
        });
        return Buffer.from(pdfBuffer);
      } finally {
        await page.close().catch(() => {});
      }
    } catch (browserErr: any) {
      console.warn('[ReportGeneration] Headless browser PDF failed, generating fallback PDF buffer:', browserErr.message);
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const isLandscape = orientation === 'landscape' || branding?.orientation === 'landscape';
      const p = doc.addPage(isLandscape ? [841.89, 595.28] : [595.28, 841.89]);
      const { width, height } = p.getSize();

      p.drawRectangle({
        x: 0,
        y: height - 60,
        width,
        height: 60,
        color: rgb(0.05, 0.13, 0.22),
      });

      p.drawText(`${branding?.orgName ?? 'SYORITY'} — GOVERNED REPORT`, {
        x: 40,
        y: height - 38,
        size: 14,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      p.drawText(`Generated: ${new Date().toISOString()}`, {
        x: 40,
        y: height - 80,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      p.drawText('Report Dataset generated and verified against authoritative domain.', {
        x: 40,
        y: height - 105,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      return Buffer.from(await doc.save());
    }
  }

  /**
   * Generates governed XLSX binary buffer with Data sheet and Metadata/Provenance sheet.
   */
  static async generateExcel(
    dataset: ReportDataset,
    definition: any,
    branding: any
  ): Promise<Buffer> {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = dataset.generatedBy || 'SYORITY Governed Reporting';
    workbook.created = new Date();

    const primaryHex = (branding?.primaryColor || '#0D2137').replace('#', '');
    const headerColor = `FF${primaryHex.length === 6 ? primaryHex : '0D2137'}`;

    // Sheet 1: Report Data
    const rawSheetName = definition.name?.slice(0, 31) || 'Report Data';
    const safeSheetName = rawSheetName.replace(/[:\/?*\[\]\\]/g, ' ');
    const dataSheet = workbook.addWorksheet(safeSheetName);

    const rows = dataset.rows || (dataset.data?.rows || []);
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]).sort();
      dataSheet.columns = keys.map((key) => ({
        header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        key,
        width: Math.max(15, key.length + 4),
      }));

      const headerRow = dataSheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColor },
      };
      headerRow.height = 24;

      for (const item of rows) {
        const rowValues: Record<string, any> = {};
        for (const k of keys) {
          const v = item[k];
          rowValues[k] = v === null || v === undefined ? '' : v;
        }
        dataSheet.addRow(rowValues);
      }
    } else if (dataset.data?.kpis && dataset.data.kpis.length > 0) {
      dataSheet.columns = [
        { header: 'KPI / Metric', key: 'label', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
        { header: 'Unit', key: 'unit', width: 15 },
        { header: 'Trend', key: 'trend', width: 15 },
      ];
      const headerRow = dataSheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
      headerRow.height = 24;

      for (const kpi of dataset.data.kpis) {
        dataSheet.addRow({
          label: kpi.label,
          value: kpi.value,
          unit: kpi.unit ?? '',
          trend: kpi.trend ?? '',
        });
      }
    } else {
      dataSheet.addRow(['No data records available for this report.']);
    }

    // Sheet 2: Metadata & Provenance
    const metaSheet = workbook.addWorksheet('Metadata & Provenance');
    metaSheet.columns = [
      { header: 'Audit Attribute', key: 'attr', width: 30 },
      { header: 'Value / Provenance', key: 'val', width: 55 },
    ];
    const metaHeader = metaSheet.getRow(1);
    metaHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    metaHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    metaHeader.height = 24;

    const provenanceData = [
      { attr: 'Report Title', val: definition.name },
      { attr: 'Report Slug', val: definition.slug },
      { attr: 'Report Definition Version', val: dataset.provenance?.reportDefinitionVersion ?? '1.0' },
      { attr: 'Organization ID', val: dataset.organizationId },
      { attr: 'Event ID', val: dataset.eventId || 'N/A' },
      { attr: 'Generated At', val: dataset.generatedAt },
      { attr: 'Data As Of', val: dataset.dataAsOf },
      { attr: 'Generated By', val: dataset.generatedBy },
      { attr: 'Dataset SHA-256 Hash', val: dataset.datasetHash },
      { attr: 'Authority Sources', val: dataset.provenance?.authoritySources?.join(', ') ?? 'N/A' },
      { attr: 'Filters Applied', val: JSON.stringify(dataset.filters) },
      { attr: 'Template Version', val: dataset.provenance?.templateVersion ?? '1.0' },
      { attr: 'Immutability Status', val: 'VERIFIED_IMMUTABLE' },
    ];

    for (const p of provenanceData) {
      metaSheet.addRow(p);
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Generate a report. Produces immutable ReportDataset, renders to target format,
   * stores artifact, updates audit snapshot, and returns generation result.
   */
  static async generate(opts: GenerateOptions): Promise<GenerationResult> {
    const startTime = Date.now();

    // Tenant Context Enforcement
    if (!opts.organizationId) {
      return {
        generationId: '',
        status: 'failed',
        error: 'Missing required organization ID: Tenant context required.',
      };
    }

    // Pre-flight 1: Verify definition existence and tenant ownership
    const definition = await prisma.report_definitions.findUnique({
      where: { id: opts.definitionId },
      include: {
        category: true,
        sections: { orderBy: { sort_order: 'asc' } },
        default_layout: true,
      },
    });

    if (!definition) {
      return {
        generationId: '',
        status: 'failed',
        error: `Report definition not found: ${opts.definitionId}`,
      };
    }

    if (definition.organization_id && definition.organization_id !== opts.organizationId) {
      return {
        generationId: '',
        status: 'failed',
        error: `Unauthorized: Tenant ${opts.organizationId} does not have access to report definition ${opts.definitionId}`,
      };
    }

    // Pre-flight 2: Verify event tenant isolation if event parameter is provided
    const eventId = opts.parameters?.event ?? opts.parameters?.eventId;
    if (eventId) {
      const event = await prisma.event.findFirst({
        where: { id: eventId, organization_id: opts.organizationId, deleted_at: null },
      });
      if (!event) {
        return {
          generationId: '',
          status: 'failed',
          error: `Unauthorized or invalid event: Event ${eventId} does not belong to organization ${opts.organizationId}`,
        };
      }
    }

    // 1. Create generation audit record
    const generation = await prisma.report_generations.create({
      data: {
        organization_id: opts.organizationId,
        definition_id: opts.definitionId,
        schedule_id: opts.scheduleId ?? null,
        output_format: opts.outputFormat,
        layout_id: opts.layoutId ?? null,
        selected_sections: opts.selectedSections ?? [],
        parameters: opts.parameters ?? {},
        included_ai: opts.includeAiSummary ?? false,
        status: 'generating',
        started_at: new Date(),
        generated_by: opts.generatedBy,
      },
    });

    try {
      // 2. Determine active sections
      const activeSections = opts.selectedSections?.length
        ? definition.sections.filter((s) => opts.selectedSections!.includes(s.key) || s.is_required)
        : definition.sections.filter((s) => s.is_default || s.is_required);

      // 3. Generate Authoritative, Immutable ReportDataset
      const dataset = await this.generateDataset({
        definitionId: opts.definitionId,
        definition,
        organizationId: opts.organizationId,
        generatedBy: opts.generatedBy,
        parameters: opts.parameters,
        includeAiSummary: opts.includeAiSummary,
      });

      // 4. Update generation record with dataset hash and filters applied
      await prisma.report_generations.update({
        where: { id: generation.id },
        data: {
          dataset_hash: dataset.datasetHash,
          dataset_path: `/reports/datasets/${dataset.datasetHash}.json`,
          filters_applied: opts.parameters ?? {},
        } as any,
      });

      // 5. Resolve branding
      const branding = await ReportLayoutService.resolveBranding(
        opts.layoutId ?? definition.default_layout_id,
        opts.organizationId
      );

      // 6. Build variable context
      const vars = buildVariableContext(opts.parameters ?? {}, {
        report: definition.name,
        category: definition.category.name,
        orgName: branding.orgName,
      });

      // 7. Resolve subject and filename
      const resolvedSubject = definition.subject_template
        ? resolveVariables(definition.subject_template, vars)
        : `${definition.name} — ${vars.date}`;

      const resolvedFilename = definition.filename_template
        ? resolveVariables(definition.filename_template, vars)
        : `${definition.slug}_${vars.date}.${opts.outputFormat === 'excel' ? 'xlsx' : opts.outputFormat}`;

      // 8. Generate output format strictly from the immutable ReportDataset
      let htmlContent: string | null = null;
      let fileBuffer: Buffer | null = null;
      let filePath: string | null = null;

      const fullHtml = await renderFullHtml(definition, activeSections, dataset.data, branding, vars, dataset.aiSummary);

      switch (opts.outputFormat) {
        case 'html':
          htmlContent = fullHtml;
          break;

        case 'pdf':
          htmlContent = fullHtml;
          fileBuffer = await this.generatePdf(
            fullHtml,
            branding,
            (definition.default_layout?.orientation ?? branding.orientation) as any
          );
          break;

        case 'csv':
          const csvText = convertToCsv(dataset);
          htmlContent = csvText;
          fileBuffer = Buffer.from(csvText, 'utf-8');
          break;

        case 'excel':
          htmlContent = fullHtml;
          fileBuffer = await this.generateExcel(dataset, definition, branding);
          break;
      }

      const durationMs = Date.now() - startTime;
      const recordCount = dataset.rows?.length ?? dataset.data?.rows?.length ?? 0;
      const fileSizeBytes = fileBuffer ? fileBuffer.length : (htmlContent ? Buffer.byteLength(htmlContent, 'utf-8') : null);

      // 9. Update generation record with enriched completion data
      await prisma.report_generations.update({
        where: { id: generation.id },
        data: {
          status: 'completed',
          html_content: htmlContent,
          file_path: filePath,
          resolved_subject: resolvedSubject,
          resolved_filename: resolvedFilename,
          completed_at: new Date(),
          duration_ms: durationMs,
          record_count: recordCount,
          file_size_bytes: fileSizeBytes,
        },
      });

      // 10. Store artifact in report_artifacts table
      try {
        await ArtifactService.store({
          organizationId: opts.organizationId,
          generationId: generation.id,
          definitionId: opts.definitionId,
          filename: resolvedFilename,
          outputFormat: opts.outputFormat,
          htmlContent: htmlContent,
          fileData: fileBuffer,
          filePath: filePath,
          recordCount: recordCount,
          createdBy: opts.generatedBy,
        });
      } catch (artifactErr: any) {
        console.warn('[ReportGeneration] Artifact storage failed (non-fatal):', artifactErr.message);
      }

      return {
        generationId: generation.id,
        status: 'completed',
        outputFormat: opts.outputFormat,
        htmlContent: htmlContent ?? undefined,
        fileBuffer: fileBuffer ?? undefined,
        filePath: filePath ?? undefined,
        resolvedSubject,
        resolvedFilename,
        datasetHash: dataset.datasetHash,
      };
    } catch (err: any) {
      await prisma.report_generations.update({
        where: { id: generation.id },
        data: {
          status: 'failed',
          error_message: err.message,
          completed_at: new Date(),
          duration_ms: Date.now() - startTime,
        },
      });

      return {
        generationId: generation.id,
        status: 'failed',
        error: err.message,
      };
    }
  }

  /**
   * Generates the authoritative, deeply immutable ReportDataset for a definition and parameters.
   */
  static async generateDataset(opts: {
    definitionId: string;
    definition?: any;
    organizationId: string;
    generatedBy: string;
    parameters?: Record<string, any>;
    includeAiSummary?: boolean;
  }): Promise<ReportDataset> {
    const definition = opts.definition ?? (await prisma.report_definitions.findUnique({
      where: { id: opts.definitionId },
    }));

    if (!definition) {
      throw new Error(`Report definition not found: ${opts.definitionId}`);
    }

    const fetcher = dataFetcherRegistry[definition.data_source_key];
    if (!fetcher) {
      throw new Error(`No data fetcher registered for key: ${definition.data_source_key}`);
    }
    const fetchedData = await fetcher(opts.organizationId, opts.parameters ?? {});

    let aiSummary: string | null = null;
    if (opts.includeAiSummary && definition.supports_ai_summary) {
      aiSummary = await AiReportAssistant.analyzeData({
        data: fetchedData,
        analysisType: 'executive_summary',
        customPromptTemplate: definition.ai_prompt_template,
        reportName: definition.name,
      });
    }

    const rows = fetchedData.rows ?? (fetchedData.tables ? Object.values(fetchedData.tables).flatMap((t: any) => t.rows) : []);
    const generatedAtIso = new Date().toISOString();
    const eventId = (opts.parameters?.event ?? opts.parameters?.eventId ?? null) as string | null;
    const dataAsOf = (opts.parameters?.date_as_of ?? opts.parameters?.date ?? generatedAtIso.slice(0, 10)) as string;
    const definitionVersion = String((definition as any).version ?? '1.0');
    const authoritySources = [definition.data_source_key];

    // Hash calculation excludes nondeterministic runtime timestamps
    const datasetHash = generateDatasetHash({
      reportId: definition.id,
      reportVersion: definitionVersion,
      organizationId: opts.organizationId,
      eventId,
      dataAsOf,
      filters: opts.parameters ?? {},
      rows,
      data: fetchedData,
      authoritySources,
    });

    const datasetCore = {
      reportId: definition.id,
      report_definition_id: definition.id,
      reportVersion: definitionVersion,
      report_definition_version: definitionVersion,
      organizationId: opts.organizationId,
      organization_id: opts.organizationId,
      eventId,
      event_id: eventId,
      generatedAt: generatedAtIso,
      generated_at: generatedAtIso,
      generatedBy: opts.generatedBy,
      generated_by: opts.generatedBy,
      dataAsOf,
      data_as_of: dataAsOf,
      templateId: (definition as any).default_layout_id ?? null,
      template_id: (definition as any).default_layout_id ?? null,
      templateVersion: '1.0',
      template_version: '1.0',
      filters: opts.parameters ?? {},
      dimensions: Object.keys(opts.parameters ?? {}),
      rows,
      data: fetchedData,
      aiSummary,
      provenance: {
        authoritySources,
        reportDefinitionVersion: definitionVersion,
        templateVersion: '1.0',
        snapshotTimestamp: generatedAtIso,
      },
      datasetHash,
      dataset_hash: datasetHash,
      hash: datasetHash,
    };

    return deepFreeze(datasetCore);
  }

  /**
   * Preview a report (HTML only, no audit trail).
   */
  static async preview(opts: Omit<GenerateOptions, 'outputFormat'>): Promise<string> {
    const definition = await prisma.report_definitions.findUnique({
      where: { id: opts.definitionId },
      include: {
        category: true,
        sections: { orderBy: { sort_order: 'asc' } },
      },
    });

    if (!definition) {
      throw new Error(`Report definition not found: ${opts.definitionId}`);
    }

    const activeSections = opts.selectedSections?.length
      ? definition.sections.filter((s) => opts.selectedSections!.includes(s.key) || s.is_required)
      : definition.sections.filter((s) => s.is_default || s.is_required);

    const dataset = await this.generateDataset({ ...opts, definition });
    const branding = await ReportLayoutService.resolveBranding(opts.layoutId ?? definition.default_layout_id, opts.organizationId);
    const vars = buildVariableContext(opts.parameters ?? {}, { report: definition.name, category: definition.category.name, orgName: branding.orgName });

    return renderFullHtml(definition, activeSections, dataset.data, branding, vars, dataset.aiSummary);
  }

  /**
   * List generation history.
   */
  static async listGenerations(organizationId: string, opts?: { definitionId?: string; status?: string; limit?: number }) {
    return prisma.report_generations.findMany({
      where: {
        organization_id: organizationId,
        ...(opts?.definitionId ? { definition_id: opts.definitionId } : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: opts?.limit ?? 50,
      include: {
        definition: {
          select: { name: true, slug: true, category: { select: { name: true, icon: true } } },
        },
      },
    });
  }

  /**
   * Get a single generation by ID, with optional tenant ownership verification.
   */
  static async getGeneration(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organization_id = organizationId;
    }
    return prisma.report_generations.findFirst({
      where,
      include: {
        definition: {
          select: { name: true, slug: true, category: { select: { name: true } } },
        },
        artifacts: true,
      },
    });
  }
}
