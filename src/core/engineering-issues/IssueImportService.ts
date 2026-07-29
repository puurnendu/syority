/**
 * IssueImportService — Multi-format file parsing for engineering issues.
 * Supports Excel/CSV (column mapping), PDF/Word (AI extraction), Email/WhatsApp.
 * M7.2 — Engineering Scope Intelligence.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import * as xlsx from 'xlsx';
import { IssueBatchService, SourceType } from './IssueBatchService';
import { callSyorityAI, SyorityAiConfig } from '@/lib/ai/universalAiClient';
import { parseVisionJson } from '@/services/ai/VisionAiService';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';

// ── Known column aliases for auto-mapping ──────────

const KNOWN_ALIASES: Record<string, string[]> = {
  issue_number: ['Issue Number', 'Issue No', 'Issue #', 'Issue ID', 'Ref', 'Reference', 'Item', 'Item No', 'Item #', 'WO', 'Work Order'],
  equipment_tag_raw: ['Equipment Tag', 'Tag', 'Tag Number', 'Tag No', 'Equipment', 'Equip Tag', 'Asset Tag', 'Equipment ID', 'Functional Location'],
  equipment_desc_raw: ['Equipment Description', 'Equipment Desc', 'Equip Description', 'Asset Description', 'Tag Description'],
  department: ['Department', 'Dept', 'Dept.', 'Source', 'Originating Dept', 'Section'],
  problem: ['Problem', 'Issue Description', 'Description', 'Defect', 'Finding', 'Observation', 'Issue', 'Problem Description', 'Deficiency', 'Anomaly'],
  recommendation: ['Recommendation', 'Action Required', 'Proposed Action', 'Corrective Action', 'Repair', 'Fix', 'Remedy', 'Proposed Solution'],
  priority: ['Priority', 'Prio', 'Urgency'],
  severity: ['Severity', 'Criticality', 'Risk', 'Risk Level', 'Classification'],
  target_ta: ['Target TA', 'TA', 'Turnaround', 'Event', 'Shutdown', 'Outage', 'Campaign'],
  originator: ['Originator', 'Raised By', 'Reporter', 'Submitted By', 'Author', 'Requestor'],
  raised_date: ['Raised Date', 'Date Raised', 'Created Date', 'Report Date', 'Date', 'Date Created'],
  due_date: ['Due Date', 'Target Date', 'Deadline', 'Required By', 'Completion Date'],
  comments: ['Comments', 'Notes', 'Remarks', 'Additional Info', 'Comment'],
  discipline: ['Discipline', 'Trade', 'Craft', 'Work Type'],
};

// Build reverse lookup: lowercased alias → field name
const ALIAS_REVERSE = new Map<string, string>();
for (const [field, aliases] of Object.entries(KNOWN_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_REVERSE.set(alias.toLowerCase().trim(), field);
  }
}

// ── Types ──────────────────────────────────────────

export type DryRunResult = {
  import_id: string;
  detected_columns: string[];
  auto_mapped: Record<string, string>;
  unmapped_columns: string[];
  total_rows: number;
  preview: ImportPreviewRow[];
  errors: ImportError[];
};

export type ImportPreviewRow = {
  row_number: number;
  issue_number: string | null;
  equipment_tag: string | null;
  department: string | null;
  problem: string | null;
  priority: string | null;
  status: 'valid' | 'warning' | 'error';
  warnings: string[];
};

export type ImportError = {
  row: number;
  field: string;
  message: string;
};

export type CommitInput = {
  organizationId: string;
  siteId?: string;
  batchName: string;
  sourceType: SourceType;
  sourceFilename?: string;
  sourceDepartment?: string;
  userId: string;
  columnMapping: Record<string, string>;
  fileBuffer: Buffer;
};

type AiExtractedIssue = {
  issue_number?: string;
  equipment_tag?: string;
  equipment_description?: string;
  department?: string;
  problem: string;
  recommendation?: string;
  priority?: string;
  severity?: string;
  originator?: string;
  raised_date?: string;
  due_date?: string;
  comments?: string;
  discipline?: string;
};

// ── AI Extraction Prompt ───────────────────────────

const ISSUE_EXTRACTION_PROMPT = `
You are analysing a document that contains engineering issues, defects, or maintenance requests from an industrial facility (refinery, petrochemical plant, power plant).

Extract ALL engineering issues you can find. Each issue should include:
- issue_number: the original reference number if present
- equipment_tag: the equipment tag (e.g. P-1001A, FV-2003, E-3001)
- equipment_description: brief equipment description
- department: originating department (Process, Maintenance, Inspection, Mechanical, Electrical, Instrumentation, Operations, Reliability, Projects, Civil, Safety, Environment, Vendor, OEM, Planner)
- problem: the engineering problem (REQUIRED)
- recommendation: proposed corrective action
- priority: critical, high, medium, low
- severity: critical, major, minor, cosmetic
- originator: person who raised the issue
- raised_date: date in ISO format
- due_date: target date in ISO format
- comments: additional notes
- discipline: Mechanical, Inspection, Electrical, Instrumentation, Operations, Civil, Reliability, Safety, Environment

Return ONLY valid JSON:
{
  "issues": [
    {
      "issue_number": string | null,
      "equipment_tag": string | null,
      "equipment_description": string | null,
      "department": string | null,
      "problem": string,
      "recommendation": string | null,
      "priority": string | null,
      "severity": string | null,
      "originator": string | null,
      "raised_date": string | null,
      "due_date": string | null,
      "comments": string | null,
      "discipline": string | null
    }
  ]
}
`;

// ── Service ────────────────────────────────────────

export class IssueImportService {
  /**
   * Dry-run: parse Excel/CSV, detect columns, auto-map, preview.
   */
  static async dryRunImport(
    fileBuffer: Buffer,
    filename: string,
    existingMapping?: Record<string, string>
  ): Promise<DryRunResult> {
    const importId = randomUUID();
    const wb = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rawData.length === 0) {
      return {
        import_id: importId,
        detected_columns: [],
        auto_mapped: {},
        unmapped_columns: [],
        total_rows: 0,
        preview: [],
        errors: [{ row: 0, field: '', message: 'No data rows found in file' }],
      };
    }

    // Detect columns
    const detectedColumns = Object.keys(rawData[0]);

    // Auto-map columns using known aliases
    const autoMapped: Record<string, string> = {};
    const unmappedColumns: string[] = [];

    for (const col of detectedColumns) {
      if (existingMapping && existingMapping[col]) {
        autoMapped[col] = existingMapping[col];
      } else {
        const normalized = col.toLowerCase().trim();
        const match = ALIAS_REVERSE.get(normalized);
        if (match) {
          autoMapped[col] = match;
        } else {
          unmappedColumns.push(col);
        }
      }
    }

    // Build preview
    const errors: ImportError[] = [];
    const previewRows = rawData.slice(0, 50).map((row, idx): ImportPreviewRow => {
      const rowNum = idx + 2; // +2 for header + 0-index
      const mapped = IssueImportService.applyMapping(row, autoMapped);
      const warnings: string[] = [];

      if (!mapped.problem && !mapped.equipment_tag) {
        errors.push({ row: rowNum, field: 'problem', message: 'No problem description or equipment tag found' });
        return {
          row_number: rowNum,
          issue_number: mapped.issue_number,
          equipment_tag: mapped.equipment_tag,
          department: mapped.department,
          problem: mapped.problem,
          priority: mapped.priority,
          status: 'error',
          warnings,
        };
      }

      if (!mapped.problem) warnings.push('No problem description — will use equipment description');
      if (!mapped.equipment_tag) warnings.push('No equipment tag — issue will be unmatched');

      return {
        row_number: rowNum,
        issue_number: mapped.issue_number,
        equipment_tag: mapped.equipment_tag,
        department: mapped.department,
        problem: mapped.problem || mapped.equipment_description || 'No description',
        priority: mapped.priority,
        status: warnings.length > 0 ? 'warning' : 'valid',
        warnings,
      };
    });

    return {
      import_id: importId,
      detected_columns: detectedColumns,
      auto_mapped: autoMapped,
      unmapped_columns: unmappedColumns,
      total_rows: rawData.length,
      preview: previewRows,
      errors,
    };
  }

  /**
   * Commit: parse file, create batch + issues.
   */
  static async commitImport(input: CommitInput) {
    const wb = xlsx.read(input.fileBuffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    // Create batch
    const batch = await IssueBatchService.createBatch({
      organizationId: input.organizationId,
      siteId: input.siteId,
      name: input.batchName,
      sourceType: input.sourceType,
      sourceFilename: input.sourceFilename,
      sourceDepartment: input.sourceDepartment,
      uploadedBy: input.userId,
    });

    let created = 0;
    let errors = 0;

    for (let i = 0; i < rawData.length; i++) {
      const mapped = IssueImportService.applyMapping(rawData[i], input.columnMapping);
      const problem = mapped.problem || mapped.equipment_description || '';

      if (!problem.trim()) {
        errors++;
        continue;
      }

      try {
        await prisma.engineeringIssue.create({
          data: {
            id: randomUUID(),
            organization_id: input.organizationId,
            site_id: input.siteId || null,
            batch_id: batch.id,
            issue_number: mapped.issue_number || null,
            equipment_tag_raw: mapped.equipment_tag || null,
            equipment_desc_raw: mapped.equipment_description || null,
            department: mapped.department || input.sourceDepartment || null,
            problem: problem.trim(),
            recommendation: mapped.recommendation || null,
            priority: IssueImportService.normalizePriority(mapped.priority),
            severity: mapped.severity || null,
            target_ta: mapped.target_ta || null,
            originator: mapped.originator || null,
            raised_date: IssueImportService.parseDate(mapped.raised_date),
            due_date: IssueImportService.parseDate(mapped.due_date),
            comments: mapped.comments || null,
            discipline: mapped.discipline || null,
            status: mapped.equipment_tag ? 'pending_review' : 'unmatched',
            created_by: input.userId,
          },
        });
        created++;
      } catch (e) {
        errors++;
      }
    }

    // Update batch counters
    await prisma.issueBatch.update({
      where: { id: batch.id },
      data: {
        total_rows: rawData.length,
        error_count: errors,
        status: 'completed',
      },
    });

    return {
      batch_id: batch.id,
      total_rows: rawData.length,
      created,
      errors,
    };
  }

  /**
   * AI extraction from PDF/Word/Email text.
   */
  static async aiExtractIssues(
    organizationId: string,
    text: string,
    sourceType: SourceType,
    userId: string,
    batchName?: string,
    department?: string,
    siteId?: string
  ) {
    // Create batch
    const batch = await IssueBatchService.createBatch({
      organizationId,
      siteId,
      name: batchName || `AI Extracted - ${new Date().toISOString().slice(0, 10)}`,
      sourceType,
      sourceDepartment: department,
      uploadedBy: userId,
      aiExtractionUsed: true,
    });

    // Load AI provider
    const provider = await loadProviderForJob(organizationId);
    const config: SyorityAiConfig = {
      provider: provider.provider,
      model: provider.model,
      apiKey: provider.apiKey,
      maxTokens: 8192,
      temperature: 0.1,
    };

    // Call AI
    const prompt = `${ISSUE_EXTRACTION_PROMPT}\n\n--- DOCUMENT TEXT ---\n${text.substring(0, 50000)}`;
    const result = await callSyorityAI(config, prompt);
    const parsed = parseVisionJson<{ issues: AiExtractedIssue[] }>(result.content);
    const issues = parsed.issues || [];

    let created = 0;
    for (const issue of issues) {
      if (!issue.problem?.trim()) continue;

      await prisma.engineeringIssue.create({
        data: {
          id: randomUUID(),
          organization_id: organizationId,
          site_id: siteId || null,
          batch_id: batch.id,
          issue_number: issue.issue_number || null,
          equipment_tag_raw: issue.equipment_tag || null,
          equipment_desc_raw: issue.equipment_description || null,
          department: issue.department || department || null,
          problem: issue.problem.trim(),
          recommendation: issue.recommendation || null,
          priority: IssueImportService.normalizePriority(issue.priority),
          severity: issue.severity || null,
          originator: issue.originator || null,
          raised_date: IssueImportService.parseDate(issue.raised_date),
          due_date: IssueImportService.parseDate(issue.due_date),
          comments: issue.comments || null,
          discipline: issue.discipline || null,
          status: issue.equipment_tag ? 'pending_review' : 'unmatched',
          created_by: userId,
        },
      });
      created++;
    }

    await prisma.issueBatch.update({
      where: { id: batch.id },
      data: { total_rows: issues.length, error_count: issues.length - created, status: 'completed' },
    });

    return {
      batch_id: batch.id,
      total_extracted: issues.length,
      created,
      ai_model: provider.model,
    };
  }

  // ── Private helpers ────────────────────────────────

  private static applyMapping(row: Record<string, unknown>, mapping: Record<string, string>) {
    const result: Record<string, string> = {};
    for (const [col, field] of Object.entries(mapping)) {
      const val = row[col];
      if (val !== undefined && val !== null && val !== '') {
        result[field] = String(val).trim();
      }
    }
    return result;
  }

  private static normalizePriority(raw?: string | null): any {
    if (!raw) return 'unclassified';
    const lower = raw.toLowerCase().trim();
    if (['1', 'critical', 'p1', 'urgent', 'emergency'].includes(lower)) return 'critical';
    if (['2', 'high', 'p2', 'important'].includes(lower)) return 'high';
    if (['3', 'medium', 'p3', 'normal', 'moderate'].includes(lower)) return 'medium';
    if (['4', 'low', 'p4', 'minor', 'routine'].includes(lower)) return 'low';
    return 'unclassified';
  }

  private static parseDate(raw?: string | null): Date | null {
    if (!raw) return null;
    try {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
}
