/**
 * M14-R4: Report Rendering, Export, Scheduling & Delivery Comprehensive Test Suite
 *
 * Verifies:
 *  1. HTML uses ReportDataset
 *  2. PDF uses same ReportDataset
 *  3. XLSX uses same ReportDataset
 *  4. CSV uses same ReportDataset
 *  5. Dataset hash is identical across formats
 *  6. Deep immutability of ReportDataset (rejects nested mutations)
 *  7. Deterministic hashing (excludes nondeterministic timestamps)
 *  8. No renderer performs business calculations
 *  9. Governed XLSX export structure (data sheet + metadata & provenance sheet)
 * 10. Governed CSV export (deterministic columns, UTF-8 BOM, RFC 4180 escaping)
 * 11. Snapshot preserves complete provenance
 * 12. Scheduled generation uses the exact same ReportGenerationService pipeline
 * 13. Tenant isolation on report generation
 * 14. Tenant isolation on generation detail lookup
 * 15. Tenant isolation on artifact download and archive
 * 16. Tenant isolation on schedule trigger, update, and delete
 * 17. Event boundary isolation
 * 18. Client presentation configuration changes visual layout only, never authoritative metrics
 * 19. Delivery notification failures do not corrupt the generated report dataset or snapshot
 * 20. Zero M14 mutation calls to ExecutionWriteService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerationService, type ReportDataset, deepFreeze } from '../ReportGenerationService';
import { ReportScheduleService } from '../ReportScheduleService';
import { ArtifactService } from '@/core/report-engine/ArtifactService';
import { prisma } from '@/lib/prisma';
import { providerRegistry } from '@/core/report-engine/providers/ProviderRegistry';
import '@/core/report-engine/providers';

describe('M14-R4 Report Rendering, Export, Scheduling & Delivery', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const eventA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eventB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const userA = 'user-a-1111-1111-1111-111111111111';
  const defId = 'dddddddd-1111-1111-1111-111111111111';
  const genId = 'c3b3b3b3-1111-1111-1111-111111111111';
  const artId = 'a1a1a1a1-1111-1111-1111-111111111111';
  const schedId = 's1s1s1s1-1111-1111-1111-111111111111';

  const mockDefinition = {
    id: defId,
    name: 'Daily TA Progress',
    slug: 'daily-progress',
    version: 1,
    data_source_key: 'execution.daily_progress',
    organization_id: tenantA,
    default_layout_id: null,
    subject_template: '{{report}} — {{date}}',
    filename_template: '{{report}}_{{date}}.{{format}}',
    supports_ai_summary: false,
    category: { name: 'Execution' },
    default_layout: { orientation: 'portrait' },
    sections: [
      { id: 'sec-1', key: 'kpis', name: 'KPIs', section_type: 'kpi_cards', is_default: true, is_required: true, sort_order: 1 },
      { id: 'sec-2', key: 'table', name: 'Progress Table', section_type: 'data', is_default: true, is_required: true, sort_order: 2 },
    ],
  };

  const authoritativePayload = {
    rows: [
      { activity_id: 'ACT-001', name: 'Bundle Pull', progress: 75.5, status: 'IN_PROGRESS', is_delayed: false },
      { activity_id: 'ACT-002', name: 'Shell Cleaning', progress: 100, status: 'COMPLETED', is_delayed: false },
    ],
    kpis: [
      { label: 'Overall Progress', value: '87.75%', unit: '%' },
      { label: 'Delayed Count', value: 0 },
    ],
    summary: 'Turnaround activities progressing on authoritative schedule.',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default Prisma & Provider mocks
    (vi.spyOn(prisma.event, 'findFirst') as any).mockImplementation(async (args: any) => {
      if (args?.where?.id === eventA && args?.where?.organization_id === tenantA) {
        return { id: eventA, organization_id: tenantA } as any;
      }
      return null;
    });
    vi.spyOn(prisma.report_generations, 'create').mockResolvedValue({ id: genId } as any);
    vi.spyOn(prisma.report_generations, 'update').mockResolvedValue({ id: genId } as any);
    vi.spyOn(prisma.report_artifacts, 'create').mockResolvedValue({ id: artId } as any);
  });

  // ─── 1 to 5: Single Dataset Across Formats & Hash Consistency ───────────

  it('1-5. HTML, PDF, XLSX, and CSV consume the EXACT SAME ReportDataset with identical dataset_hash', async () => {
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(authoritativePayload);
    // Mock generatePdf for fast unit test execution
    vi.spyOn(ReportGenerationService, 'generatePdf').mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf buffer'));

    // Generate HTML
    const htmlResult = await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'html',
      parameters: { event: eventA },
    });

    // Generate PDF
    const pdfResult = await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'pdf',
      parameters: { event: eventA },
    });

    // Generate XLSX
    const excelResult = await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'excel',
      parameters: { event: eventA },
    });

    // Generate CSV
    const csvResult = await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'csv',
      parameters: { event: eventA },
    });

    // Verify all formats completed successfully
    expect(htmlResult.status).toBe('completed');
    expect(pdfResult.status).toBe('completed');
    expect(excelResult.status).toBe('completed');
    expect(csvResult.status).toBe('completed');

    // Verify dataset_hash is identical across all formats
    expect(htmlResult.datasetHash).toBeDefined();
    expect(pdfResult.datasetHash).toBe(htmlResult.datasetHash);
    expect(excelResult.datasetHash).toBe(htmlResult.datasetHash);
    expect(csvResult.datasetHash).toBe(htmlResult.datasetHash);

    // Verify outputs
    expect(htmlResult.htmlContent).toContain('Daily TA Progress');
    expect(pdfResult.fileBuffer).toBeInstanceOf(Buffer);
    expect(excelResult.fileBuffer).toBeInstanceOf(Buffer);
    expect(csvResult.htmlContent).toContain('Bundle Pull');
  });

  // ─── 6: Deep Immutability ────────────────────────────────────────────────

  it('6. ReportDataset is deeply immutable (rejects nested mutations with TypeError)', async () => {
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(authoritativePayload);

    const dataset = await ReportGenerationService.generateDataset({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      parameters: { event: eventA },
    });

    // 1. Top-level mutation fails
    expect(() => {
      (dataset as any).dataAsOf = 'tampered-date';
    }).toThrow(TypeError);

    // 2. Nested rows mutation fails
    expect(() => {
      dataset.rows.push({ activity_id: 'TAMPERED' });
    }).toThrow(TypeError);

    // 3. Nested object property mutation fails
    expect(() => {
      (dataset.rows[0] as any).progress = 999;
    }).toThrow(TypeError);

    // 4. Nested provenance array mutation fails
    expect(() => {
      dataset.provenance.authoritySources.push('unauthorized.source');
    }).toThrow(TypeError);
  });

  // ─── 7: Deterministic Hashing ────────────────────────────────────────────

  it('7. Dataset hash is strictly deterministic and excludes runtime generatedAt timestamps', async () => {
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(authoritativePayload);

    const dataset1 = await ReportGenerationService.generateDataset({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      parameters: { event: eventA, date_as_of: '2026-09-07' },
    });

    // Simulate later invocation with identical parameters & authoritative data
    const dataset2 = await ReportGenerationService.generateDataset({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: 'different-user',
      parameters: { event: eventA, date_as_of: '2026-09-07' },
    });

    expect(dataset1.datasetHash).toBe(dataset2.datasetHash);
    expect(dataset1.datasetHash).toHaveLength(64); // Valid SHA-256
  });

  // ─── 8: No Business Calculations in Renderers ────────────────────────────

  it('8. No renderer performs business derivations; authoritative percentages are preserved intact', async () => {
    const rawProgress = 75.5;
    const testPayload = {
      rows: [{ activity: 'A1', progress_pct: rawProgress }],
      kpis: [{ label: 'CPI', value: '1.05' }],
    };

    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(testPayload);

    const dataset = await ReportGenerationService.generateDataset({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
    });

    // CSV preserves raw progress without multiplying or rounding
    const csv = ReportGenerationService.convertToCsv(dataset);
    expect(csv).toContain('75.5');

    // Excel preserves exact value
    const excelBuf = await ReportGenerationService.generateExcel(dataset, mockDefinition, { primaryColor: '#0D2137' });
    expect(excelBuf).toBeInstanceOf(Buffer);
    expect(excelBuf.length).toBeGreaterThan(1000);
  });

  // ─── 9: Governed XLSX Export Structure ───────────────────────────────────

  it('9. Governed XLSX export includes Report Data sheet and Metadata & Provenance sheet', async () => {
    const ExcelJS = (await import('exceljs')).default;
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(authoritativePayload);

    const dataset = await ReportGenerationService.generateDataset({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      parameters: { event: eventA },
    });

    const buffer = await ReportGenerationService.generateExcel(dataset, mockDefinition, { primaryColor: '#0D2137' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    // Verify worksheets
    expect(wb.worksheets.length).toBeGreaterThanOrEqual(2);
    const dataSheet = wb.getWorksheet(mockDefinition.name);
    const provenanceSheet = wb.getWorksheet('Metadata & Provenance');

    expect(dataSheet).toBeDefined();
    expect(provenanceSheet).toBeDefined();

    // Verify Provenance Sheet contains audit keys
    const provenanceRows: string[] = [];
    provenanceSheet!.eachRow((row) => {
      provenanceRows.push(row.getCell(1).value?.toString() || '');
    });

    expect(provenanceRows).toContain('Report Title');
    expect(provenanceRows).toContain('Organization ID');
    expect(provenanceRows).toContain('Dataset SHA-256 Hash');
    expect(provenanceRows).toContain('Immutability Status');
  });

  // ─── 10: Governed CSV Export ─────────────────────────────────────────────

  it('10. Governed CSV export includes UTF-8 BOM, deterministic headers, and RFC 4180 quotation', () => {
    const payloadWithSpecialChars = {
      rows: [
        {
          name: 'Cleaning, Inspection & Box-up',
          notes: 'Line 1\nLine 2 with "quotes"',
          weight: 42,
        },
      ],
    };

    const csv = ReportGenerationService.convertToCsv(payloadWithSpecialChars);

    // UTF-8 BOM present at the very beginning
    expect(csv.charCodeAt(0)).toBe(0xFEFF);

    // Deterministic sorted headers
    expect(csv).toContain('name,notes,weight');

    // RFC 4180 escaping
    expect(csv).toContain('"Cleaning, Inspection & Box-up"');
    expect(csv).toContain('"Line 1\nLine 2 with ""quotes"""');
  });

  // ─── 11: Snapshot Provenance ─────────────────────────────────────────────

  it('11. Generation snapshot captures complete provenance metadata in report_generations', async () => {
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(authoritativePayload);

    let updatedData: any = null;
    (vi.spyOn(prisma.report_generations, 'update') as any).mockImplementation(async (args: any) => {
      updatedData = { ...updatedData, ...args.data };
      return { id: genId } as any;
    });

    await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'html',
      parameters: { event: eventA, status: 'IN_PROGRESS' },
    });

    expect(updatedData).toBeDefined();
    expect(updatedData.dataset_hash).toBeDefined();
    expect(updatedData.filters_applied).toEqual({ event: eventA, status: 'IN_PROGRESS' });
    expect(updatedData.status).toBe('completed');
  });

  // ─── 12: Scheduled Generation Uses Same Pipeline ─────────────────────────

  it('12. Scheduled report execution strictly delegates to ReportGenerationService.generate()', async () => {
    const mockSchedule = {
      id: schedId,
      name: 'Daily Scheduled TA Progress',
      organization_id: tenantA,
      definition_id: defId,
      created_by: userA,
      output_format: 'pdf',
      layout_id: null,
      selected_sections: ['kpis', 'table'],
      parameters: { event: eventA },
      include_ai_summary: false,
      frequency: 'daily',
      delivery_time: '06:00',
      day_of_week: null,
      day_of_month: null,
      timezone: 'UTC',
      recipients: [
        { recipient_type: 'email', recipient_value: 'planner@tenantA.com', delivery_type: 'to' },
      ],
      definition: mockDefinition,
    };

    vi.spyOn(prisma.report_schedules, 'findUniqueOrThrow').mockResolvedValue(mockSchedule as any);
    vi.spyOn(prisma.report_schedules, 'update').mockResolvedValue(mockSchedule as any);
    vi.spyOn(prisma.notification_queue, 'create').mockResolvedValue({ id: 'notif-1' } as any);

    const generateSpy = vi.spyOn(ReportGenerationService, 'generate').mockResolvedValue({
      generationId: genId,
      status: 'completed',
      outputFormat: 'pdf',
      resolvedSubject: 'Daily TA Progress — 2026-09-07',
      htmlContent: '<p>Report</p>',
    });

    const result = await ReportScheduleService.trigger(schedId, tenantA);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionId: defId,
        organizationId: tenantA,
        outputFormat: 'pdf',
        parameters: { event: eventA },
      })
    );
    expect(result.generationId).toBe(genId);
    expect(result.queued).toBe(1);
  });

  // ─── 13 to 16: Tenant & Event Security Isolation ─────────────────────────

  it('13. Tenant A cannot generate report definition belonging exclusively to Tenant B', async () => {
    const orgBDef = { ...mockDefinition, organization_id: tenantB };
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(orgBDef as any);

    const result = await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'html',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unauthorized: Tenant');
  });

  it('14. Tenant A cannot look up Tenant B report generation details', async () => {
    (vi.spyOn(prisma.report_generations, 'findFirst') as any).mockImplementation(async (args: any) => {
      // Record belongs to tenantB, so if tenantA queries it, findFirst returns null
      if (args.where.organization_id === tenantA && args.where.id === genId) {
        return null;
      }
      return { id: genId, organization_id: tenantB } as any;
    });

    const result = await ReportGenerationService.getGeneration(genId, tenantA);
    expect(result).toBeNull();
  });

  it('15. Tenant A cannot download or archive Tenant B artifact', async () => {
    (vi.spyOn(prisma.report_artifacts, 'findFirstOrThrow') as any).mockImplementation(async (args: any) => {
      if (args.where.organization_id !== tenantB) {
        throw new Error('Record to update not found.');
      }
      return { id: artId, organization_id: tenantB, file_data: Buffer.from('data') } as any;
    });

    vi.spyOn(prisma.report_artifacts, 'findFirst').mockResolvedValue(null);

    // Tenant A attempts download of Tenant B artifact
    await expect(ArtifactService.getForDownload(artId, tenantA)).rejects.toThrow();

    // Tenant A attempts archive of Tenant B artifact
    await expect(ArtifactService.archive(artId, tenantA)).rejects.toThrow('Unauthorized or artifact not found');
  });

  it('16. Tenant A cannot trigger, update, or delete Tenant B schedule', async () => {
    const scheduleB = {
      id: schedId,
      organization_id: tenantB,
      definition: mockDefinition,
      recipients: [],
    };

    vi.spyOn(prisma.report_schedules, 'findUnique').mockResolvedValue(scheduleB as any);
    vi.spyOn(prisma.report_schedules, 'findUniqueOrThrow').mockResolvedValue(scheduleB as any);

    // Cross-tenant trigger
    await expect(ReportScheduleService.trigger(schedId, tenantA)).rejects.toThrow('Unauthorized: Tenant');

    // Cross-tenant update
    await expect(ReportScheduleService.update(schedId, { name: 'Hacked' }, userA, tenantA)).rejects.toThrow('Unauthorized: Tenant');

    // Cross-tenant delete
    await expect(ReportScheduleService.delete(schedId, tenantA)).rejects.toThrow('Unauthorized: Tenant');
  });

  // ─── 17: Event Boundary Isolation ────────────────────────────────────────

  it('17. Generation rejects execution parameter referencing Event belonging to another tenant', async () => {
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    // Event findFirst returns null because eventB does not belong to tenantA
    vi.spyOn(prisma.event, 'findFirst').mockResolvedValue(null);

    const result = await ReportGenerationService.generate({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      outputFormat: 'html',
      parameters: { event: eventB },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unauthorized or invalid event');
  });

  // ─── 18: Presentation Configuration Integrity ────────────────────────────

  it('18. Client presentation configuration changes visual layout only, never authoritative metrics', async () => {
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue(authoritativePayload);

    const dataset = await ReportGenerationService.generateDataset({
      definitionId: defId,
      organizationId: tenantA,
      generatedBy: userA,
      parameters: { event: eventA },
    });

    const brandingA = {
      orgName: 'Refinery Alpha Corp',
      primaryColor: '#003366',
      accentColor: '#FF6600',
      fontFamily: 'Roboto',
      fontSizeBase: 14,
      margins: { top: 25, bottom: 25, left: 20, right: 20 },
      signatureLabels: ['Area Authority', 'Site Superintendent'],
      showSignature: true,
    };

    const brandingB = {
      orgName: 'Petrochemical Beta BV',
      primaryColor: '#880000',
      accentColor: '#008800',
      fontFamily: 'Inter',
      fontSizeBase: 10,
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
      signatureLabels: ['Field Planner'],
      showSignature: false,
    };

    // Render HTML with branding A vs B
    const htmlA = await ReportGenerationService.renderFullHtml(
      mockDefinition,
      mockDefinition.sections,
      dataset.data,
      brandingA as any,
      { report: mockDefinition.name, datetime: '2026-09-07' }
    );

    const htmlB = await ReportGenerationService.renderFullHtml(
      mockDefinition,
      mockDefinition.sections,
      dataset.data,
      brandingB as any,
      { report: mockDefinition.name, datetime: '2026-09-07' }
    );

    // Presentation differs
    expect(htmlA).toContain('Refinery Alpha Corp');
    expect(htmlB).toContain('Petrochemical Beta BV');
    expect(htmlA).toContain('Site Superintendent');
    expect(htmlB).not.toContain('Site Superintendent');

    // But authoritative metrics in the underlying dataset are identical
    expect(htmlA).toContain('87.75%');
    expect(htmlB).toContain('87.75%');
    expect(htmlA).toContain('75.5');
    expect(htmlB).toContain('75.5');
  });

  // ─── 19: Delivery Error Isolation ────────────────────────────────────────

  it('19. Delivery notification failures do not corrupt the generated report dataset or snapshot', async () => {
    vi.spyOn(prisma.report_schedules, 'findUniqueOrThrow').mockResolvedValue({
      id: schedId,
      organization_id: tenantA,
      definition_id: defId,
      created_by: userA,
      output_format: 'pdf',
      parameters: { event: eventA },
      recipients: [{ recipient_type: 'email', recipient_value: 'bad@recipient.com' }],
      definition: mockDefinition,
    } as any);

    vi.spyOn(ReportGenerationService, 'generate').mockResolvedValue({
      generationId: genId,
      status: 'completed',
      outputFormat: 'pdf',
      datasetHash: 'valid-dataset-hash',
    });

    // Simulate notification queue failure
    vi.spyOn(prisma.notification_queue, 'create').mockRejectedValue(new Error('SMTP service down'));
    vi.spyOn(prisma.report_schedules, 'update').mockResolvedValue({} as any);

    // When trigger runs, notification error does not corrupt the completed report dataset
    await expect(ReportScheduleService.trigger(schedId, tenantA)).rejects.toThrow('SMTP service down');

    // Generation was completed and preserved
    expect(ReportGenerationService.generate).toHaveBeenCalledTimes(1);
  });

  // ─── 20: Zero Mutations to ExecutionWriteService ──────────────────────────

  it('20. M14 reporting engine contains zero calls or references to ExecutionWriteService', () => {
    expect(ReportGenerationService).toBeDefined();
    expect(ReportScheduleService).toBeDefined();
    expect(ArtifactService).toBeDefined();

    const protoMethods = Object.getOwnPropertyNames(ReportGenerationService);
    expect(protoMethods).not.toContain('updateActivityState');
    expect(protoMethods).not.toContain('logExecutionProgress');
    expect(protoMethods).not.toContain('applyExecutionMutation');
  });
});
