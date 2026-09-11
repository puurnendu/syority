/**
 * PlantImportService — Excel import with dry-run, commit, and rollback.
 * Supports: Equipment List, Valve List, Line List, Instrument List, Asset Register.
 * M7.1 — Digital Plant Builder.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import * as xlsx from 'xlsx';
import { DigitalPlantService } from './DigitalPlantService';

// ── Types ──────────────────────────────────────────

export type ImportType = 'equipment_list' | 'valve_list' | 'line_list' | 'instrument_list' | 'asset_register';

export type DryRunResult = {
  import_id: string;
  import_type: ImportType;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  update_rows: number;
  new_rows: number;
  preview: ImportRow[];
  errors: ImportError[];
};

export type ImportRow = {
  row_number: number;
  tag_number: string;
  description: string | null;
  asset_type: string;
  status: 'new' | 'update' | 'error';
  error_message?: string;
  attributes: Record<string, unknown>;
};

type ImportError = {
  row: number;
  field: string;
  message: string;
};

// ── Column mappings per import type ────────────────

const COLUMN_MAP: Record<ImportType, Record<string, string>> = {
  equipment_list: {
    'Tag': 'tag_number', 'Tag Number': 'tag_number', 'Equipment Tag': 'tag_number',
    'Description': 'description', 'Equipment Description': 'description',
    'Type': 'asset_type', 'Equipment Type': 'asset_type',
    'Manufacturer': 'manufacturer', 'Model': 'model',
    'Serial Number': 'serial_number', 'Serial': 'serial_number',
    'Service': 'service_description',
    'Design Pressure': 'design_pressure_barg', 'Design Temp': 'design_temp_c',
    'Material': 'material',
  },
  valve_list: {
    'Tag': 'tag_number', 'Valve Tag': 'tag_number',
    'Description': 'description', 'Size': 'size', 'Rating': 'rating',
    'Type': 'valve_type', 'Service': 'service_description',
    'Line Number': 'line_number',
  },
  line_list: {
    'Line Number': 'tag_number', 'Line No': 'tag_number',
    'Size': 'size', 'Spec': 'pipe_class', 'Service': 'service_description',
    'From': 'from_tag', 'To': 'to_tag', 'Insulation': 'insulation',
    'Test Pressure': 'test_pressure',
  },
  instrument_list: {
    'Tag': 'tag_number', 'Instrument Tag': 'tag_number',
    'Description': 'description', 'Type': 'instrument_type',
    'Range': 'range', 'Service': 'service_description',
    'Loop': 'loop_number',
  },
  asset_register: {
    'Tag': 'tag_number', 'Tag Number': 'tag_number',
    'Name': 'name', 'Description': 'description',
    'Type': 'asset_type', 'Manufacturer': 'manufacturer',
    'Model': 'model', 'Serial': 'serial_number',
    'Service': 'service_description',
  },
};

// ── Service ────────────────────────────────────────

export class PlantImportService {
  /**
   * Dry-run: parse Excel and validate without writing to database.
   */
  static async dryRunImport(
    organizationId: string,
    projectId: string,
    file: File,
    importType: ImportType
  ): Promise<DryRunResult> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data: Record<string, unknown>[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const columnMap = COLUMN_MAP[importType];
    const importId = randomUUID();
    const preview: ImportRow[] = [];
    const errors: ImportError[] = [];

    // Resolve existing tags for duplicate detection
    const allTags = data
      .map((row) => {
        for (const [excelCol, field] of Object.entries(columnMap)) {
          if (field === 'tag_number' && row[excelCol]) return String(row[excelCol]).trim();
        }
        return null;
      })
      .filter(Boolean) as string[];

    const existingAssets = await prisma.asset.findMany({
      where: { organization_id: organizationId, tag_number: { in: allTags } },
      select: { tag_number: true },
    });
    const existingSet = new Set(existingAssets.map((a) => a.tag_number));

    // M8.14-R1: Valid criticality values
    const VALID_CRITICALITY = new Set(['low', 'medium', 'high', 'critical']);
    const CRITICALITY_SYNONYMS: Record<string, string> = {
      l: 'low', med: 'medium', m: 'medium', moderate: 'medium',
      h: 'high', crit: 'critical', c: 'critical', 'very high': 'critical',
    };
    const normalizeCriticality = (raw?: string | null): string | null => {
      if (!raw) return null;
      const v = raw.trim().toLowerCase();
      if (VALID_CRITICALITY.has(v)) return v;
      return CRITICALITY_SYNONYMS[v] ?? null;
    };

    // M8.14-R1: Known asset types (for warnings, not hard reject)
    const KNOWN_ASSET_TYPES = new Set([
      'equipment', 'vessel', 'heat_exchanger', 'pump', 'compressor', 'column',
      'tank', 'reactor', 'drum', 'heater', 'filter', 'motor', 'turbine',
      'fan', 'air_cooler', 'valve', 'instrument', 'pipeline',
    ]);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const mapped: Record<string, unknown> = {};

      for (const [excelCol, field] of Object.entries(columnMap)) {
        if (row[excelCol] !== undefined && row[excelCol] !== null) {
          mapped[field] = String(row[excelCol]).trim();
        }
      }

      const tagNumber = mapped.tag_number as string;

      // Validation: tag_number required
      if (!tagNumber) {
        errors.push({ row: i + 2, field: 'tag_number', message: 'Tag number is required' });
        preview.push({
          row_number: i + 2,
          tag_number: '',
          description: (mapped.description as string) || null,
          asset_type: importType === 'valve_list' ? 'valve' : importType === 'instrument_list' ? 'instrument' : importType === 'line_list' ? 'pipeline' : 'equipment',
          status: 'error',
          error_message: 'Missing tag number',
          attributes: mapped,
        });
        continue;
      }

      // M8.14-R1: Validate mandatory name/description
      const name = (mapped.name as string) || (mapped.description as string);
      if (!name) {
        errors.push({ row: i + 2, field: 'name', message: 'Name or description is required' });
        preview.push({
          row_number: i + 2,
          tag_number: tagNumber,
          description: null,
          asset_type: (mapped.asset_type as string) || this.inferAssetType(tagNumber, importType),
          status: 'error',
          error_message: 'Missing name/description',
          attributes: mapped,
        });
        continue;
      }

      // M8.14-R1: Validate criticality (if provided)
      const rawCrit = mapped.criticality as string | undefined;
      if (rawCrit) {
        const normalizedCrit = normalizeCriticality(rawCrit);
        if (!normalizedCrit) {
          errors.push({ row: i + 2, field: 'criticality', message: `Invalid criticality "${rawCrit}" — must be: low, medium, high, critical` });
          preview.push({
            row_number: i + 2,
            tag_number: tagNumber,
            description: name,
            asset_type: (mapped.asset_type as string) || this.inferAssetType(tagNumber, importType),
            status: 'error',
            error_message: `Invalid criticality: ${rawCrit}`,
            attributes: mapped,
          });
          continue;
        }
        mapped.criticality = normalizedCrit;
      }

      // M8.14-R1: Warn on unrecognized asset type (not a hard reject)
      const assetType = (mapped.asset_type as string) || this.inferAssetType(tagNumber, importType);
      if (mapped.asset_type && !KNOWN_ASSET_TYPES.has(assetType.toLowerCase().replace(/\s+/g, '_'))) {
        errors.push({ row: i + 2, field: 'asset_type', message: `Unrecognized asset type "${mapped.asset_type}" — will import as-is` });
        // Note: this is a warning, not a rejection — the row still imports
      }

      const isUpdate = existingSet.has(tagNumber);

      preview.push({
        row_number: i + 2,
        tag_number: tagNumber,
        description: name,
        asset_type: assetType,
        status: isUpdate ? 'update' : 'new',
        attributes: mapped,
      });
    }

    return {
      import_id: importId,
      import_type: importType,
      total_rows: data.length,
      valid_rows: preview.filter((r) => r.status !== 'error').length,
      error_rows: errors.length,
      update_rows: preview.filter((r) => r.status === 'update').length,
      new_rows: preview.filter((r) => r.status === 'new').length,
      preview,
      errors,
    };
  }

  /**
   * Commit: create ExtractionCandidates from validated import data.
   * Candidates still require planner review (NOT auto-committed to Asset table).
   */
  static async commitImport(
    organizationId: string,
    projectId: string,
    dryRunResult: DryRunResult,
    documentId: string,
    userId: string
  ) {
    const batchId = randomUUID();
    const validRows = dryRunResult.preview.filter((r) => r.status !== 'error');

    const candidates = validRows.map((row) => ({
      id: randomUUID(),
      organization_id: organizationId,
      project_id: projectId,
      source_document_id: documentId,
      candidate_type: row.asset_type,
      tag_number: row.tag_number,
      description: row.description,
      confidence_score: 1.0, // Excel imports are high confidence (human-entered data)
      extracted_attributes: row.attributes,
      source_page: null as number | null,
      status: 'pending_review' as const,
      import_batch_id: batchId,
    }));

    if (candidates.length > 0) {
      await prisma.extractionCandidate.createMany({ data: candidates });
      await DigitalPlantService.incrementCounters(projectId, 'total_candidates', candidates.length);
    }

    return {
      batch_id: batchId,
      candidates_created: candidates.length,
      message: `${candidates.length} candidates created for planner review.`,
    };
  }

  /**
   * Rollback: delete all candidates from a specific import batch.
   */
  static async rollbackImport(
    organizationId: string,
    batchId: string,
    userId: string
  ) {
    // Check if any candidates from this batch have been approved
    const approved = await prisma.extractionCandidate.count({
      where: { import_batch_id: batchId, status: 'approved' },
    });
    if (approved > 0) {
      throw new Error(`Cannot rollback: ${approved} candidates from this batch have been approved.`);
    }

    const deleted = await prisma.extractionCandidate.deleteMany({
      where: {
        organization_id: organizationId,
        import_batch_id: batchId,
        status: { in: ['pending_review', 'edited'] },
      },
    });

    return {
      batch_id: batchId,
      candidates_deleted: deleted.count,
    };
  }

  /**
   * Infer asset type from tag prefix.
   */
  private static inferAssetType(tag: string, importType: ImportType): string {
    if (importType === 'valve_list') return 'valve';
    if (importType === 'instrument_list') return 'instrument';
    if (importType === 'line_list') return 'pipeline';

    const prefix = tag.split('-')[0]?.toUpperCase() || '';
    const MAP: Record<string, string> = {
      'E': 'heat_exchanger', 'EA': 'air_cooler', 'P': 'pump', 'V': 'vessel',
      'T': 'tank', 'K': 'compressor', 'C': 'column', 'FN': 'fan',
      'R': 'reactor', 'DR': 'drum', 'F': 'heater', 'H': 'heater',
      'FI': 'filter', 'M': 'motor', 'GT': 'turbine', 'ST': 'turbine',
    };
    return MAP[prefix] || 'equipment';
  }
}
