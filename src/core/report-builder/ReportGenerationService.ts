/**
 * M7.6A — Report Generation Service
 *
 * Core engine: Takes a report definition + parameters → generates output.
 * Renders sections, resolves variables, produces HTML/PDF/Excel/CSV.
 * Feeds completed reports to the notification platform for delivery.
 */

import { prisma } from '@/lib/prisma';
import { ReportLayoutService } from './ReportLayoutService';
import { dataFetcherRegistry, type DataFetcherResult } from './data-fetchers';
import { ArtifactService } from '@/core/report-engine/ArtifactService';
import { AiReportAssistant } from '@/core/report-engine/AiReportAssistant';

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

export interface GenerationResult {
  generationId: string;
  status: 'completed' | 'failed';
  htmlContent?: string;
  filePath?: string;
  resolvedSubject?: string;
  resolvedFilename?: string;
  error?: string;
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

  const cols = columns ?? Object.keys(data[0]).map((k) => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));

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
      // Charts render as a placeholder in HTML; PDF generation converts to images
      sectionHtml.push(`<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:40px;text-align:center;color:#9CA3AF;">
        <div style="font-size:14px;">📊 ${section.chart_type?.toUpperCase() ?? 'CHART'}: ${section.name}</div>
        <div style="font-size:12px;margin-top:8px;">Chart data available — renders in PDF output</div>
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

  // AI Executive Summary (if requested)
  if (aiSummary) {
    sectionHtmlParts.push(renderSummaryBlock('🤖 AI Executive Summary', aiSummary));
  }

  // Render each selected section
  for (const section of sections) {
    sectionHtmlParts.push(await renderSection(section, fetchedData, branding));
  }

  // Resolve header/footer variables
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
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
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

// ─── CSV/Excel Conversion ───────────────────────────────────────────────────

function convertToCsv(data: DataFetcherResult): string {
  const rows = data.rows ?? [];
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const headerRow = keys.join(',');
  const dataRows = rows.map((row: any) =>
    keys.map((k) => {
      const val = row[k];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// ─── AI Summary ─────────────────────────────────────────────────────────────

async function generateAiSummary(
  definition: any,
  data: DataFetcherResult,
  _orgId: string
): Promise<string | null> {
  try {
    // Check if AI provider is configured
    const aiConfig = await prisma.aI_Provider_Config.findFirst({
      where: { is_active: true },
    }).catch(() => null);

    if (!aiConfig) {
      return '<em>AI summary unavailable — no AI provider configured.</em>';
    }

    // Build a data summary for the AI prompt
    const dataSummary = JSON.stringify({
      kpis: data.kpis?.slice(0, 10),
      rowCount: data.rows?.length ?? 0,
      sampleRows: data.rows?.slice(0, 5),
      summary: data.summary,
    }, null, 2).slice(0, 3000);

    const prompt = definition.ai_prompt_template
      ? resolveVariables(definition.ai_prompt_template, { data: dataSummary })
      : `You are an executive report summarizer for a turnaround/shutdown management platform.

Based on this report data for "${definition.name}":
${dataSummary}

Provide a concise executive summary covering:
1. Key highlights and achievements
2. Top risks and concerns
3. Critical delays or issues
4. Recommended actions
5. Tomorrow's priorities

Keep it under 300 words. Use bullet points for clarity.`;

    // Use the configured AI provider via dynamic import
    const { generateText } = await import('@/lib/ai/textGeneration').catch(() => ({
      generateText: null,
    }));

    if (!generateText) {
      return '<em>AI summary unavailable — text generation service not configured.</em>';
    }

    const result = await (generateText as Function)(prompt);
    return typeof result === 'string' ? result.replace(/\n/g, '<br/>') : '<em>AI summary generation failed.</em>';
  } catch (err: any) {
    console.warn('[ReportGeneration] AI summary failed:', err.message);
    return '<em>AI summary unavailable — generation failed.</em>';
  }
}

// ─── Main Generation Function ───────────────────────────────────────────────

export class ReportGenerationService {
  /**
   * Generate a report. Returns the generation record ID and result.
   */
  static async generate(opts: GenerateOptions): Promise<GenerationResult> {
    const startTime = Date.now();

    // 1. Create generation record
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
      // 2. Load definition with sections
      const definition = await prisma.report_definitions.findUniqueOrThrow({
        where: { id: opts.definitionId },
        include: {
          category: true,
          sections: { orderBy: { sort_order: 'asc' } },
        },
      });

      // 3. Determine which sections to render
      const activeSections = opts.selectedSections?.length
        ? definition.sections.filter((s) => opts.selectedSections!.includes(s.key) || s.is_required)
        : definition.sections.filter((s) => s.is_default || s.is_required);

      // 4. Fetch data
      const fetcher = dataFetcherRegistry[definition.data_source_key];
      if (!fetcher) {
        throw new Error(`No data fetcher registered for key: ${definition.data_source_key}`);
      }
      const fetchedData = await fetcher(opts.organizationId, opts.parameters ?? {});

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

      // 7. AI Summary (optional — M7.6B: uses AiReportAssistant)
      let aiSummary: string | null = null;
      if (opts.includeAiSummary && definition.supports_ai_summary) {
        aiSummary = await AiReportAssistant.analyzeData({
          data: fetchedData,
          analysisType: 'executive_summary',
          customPromptTemplate: definition.ai_prompt_template,
          reportName: definition.name,
        });
      }

      // 8. Resolve subject and filename
      const resolvedSubject = definition.subject_template
        ? resolveVariables(definition.subject_template, vars)
        : `${definition.name} — ${vars.date}`;

      const resolvedFilename = definition.filename_template
        ? resolveVariables(definition.filename_template, vars)
        : `${definition.slug}_${vars.date}.${opts.outputFormat}`;

      // 9. Generate output based on format
      let htmlContent: string | null = null;
      let filePath: string | null = null;

      switch (opts.outputFormat) {
        case 'html':
          htmlContent = await renderFullHtml(definition, activeSections, fetchedData, branding, vars, aiSummary);
          break;

        case 'pdf':
          htmlContent = await renderFullHtml(definition, activeSections, fetchedData, branding, vars, aiSummary);
          // PDF generation is deferred to client-side or a separate worker
          // For now, store the HTML and mark as requiring PDF conversion
          break;

        case 'csv':
          htmlContent = convertToCsv(fetchedData);
          break;

        case 'excel':
          // Excel generation requires exceljs — deferred to download endpoint
          htmlContent = await renderFullHtml(definition, activeSections, fetchedData, branding, vars, aiSummary);
          break;
      }

      const durationMs = Date.now() - startTime;

      // 10. Compute record count from fetched data
      const recordCount = fetchedData.rows?.length ?? 0;

      // 11. Update generation record with enriched data
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
          file_size_bytes: htmlContent ? Buffer.byteLength(htmlContent, 'utf-8') : null,
        },
      });

      // 12. Store artifact (M7.6B)
      try {
        await ArtifactService.store({
          organizationId: opts.organizationId,
          generationId: generation.id,
          definitionId: opts.definitionId,
          filename: resolvedFilename,
          outputFormat: opts.outputFormat,
          htmlContent,
          recordCount,
          createdBy: opts.generatedBy,
        });
      } catch (artifactErr: any) {
        console.warn('[ReportGeneration] Artifact storage failed (non-fatal):', artifactErr.message);
      }

      return {
        generationId: generation.id,
        status: 'completed',
        htmlContent: htmlContent ?? undefined,
        filePath: filePath ?? undefined,
        resolvedSubject,
        resolvedFilename,
      };
    } catch (err: any) {
      // Update generation with error
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
   * Preview a report (HTML only, no audit trail).
   */
  static async preview(opts: Omit<GenerateOptions, 'outputFormat'>): Promise<string> {
    const definition = await prisma.report_definitions.findUniqueOrThrow({
      where: { id: opts.definitionId },
      include: {
        category: true,
        sections: { orderBy: { sort_order: 'asc' } },
      },
    });

    const activeSections = opts.selectedSections?.length
      ? definition.sections.filter((s) => opts.selectedSections!.includes(s.key) || s.is_required)
      : definition.sections.filter((s) => s.is_default || s.is_required);

    const fetcher = dataFetcherRegistry[definition.data_source_key];
    if (!fetcher) throw new Error(`No data fetcher for: ${definition.data_source_key}`);

    const fetchedData = await fetcher(opts.organizationId, opts.parameters ?? {});
    const branding = await ReportLayoutService.resolveBranding(opts.layoutId ?? definition.default_layout_id, opts.organizationId);
    const vars = buildVariableContext(opts.parameters ?? {}, { report: definition.name, category: definition.category.name, orgName: branding.orgName });

    let aiSummary: string | null = null;
    if (opts.includeAiSummary && definition.supports_ai_summary) {
      aiSummary = await AiReportAssistant.analyzeData({
        data: fetchedData,
        analysisType: 'executive_summary',
        customPromptTemplate: definition.ai_prompt_template,
        reportName: definition.name,
      });
    }

    return renderFullHtml(definition, activeSections, fetchedData, branding, vars, aiSummary);
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
   * Get a single generation by ID.
   */
  static async getGeneration(id: string) {
    return prisma.report_generations.findUnique({
      where: { id },
      include: {
        definition: {
          select: { name: true, slug: true, category: { select: { name: true } } },
        },
      },
    });
  }
}
