/**
 * ExtractionService — AI-powered extraction from engineering documents.
 * Calls VisionAiService, creates ExtractionCandidate rows (never auto-approves).
 * Enhanced prompt covering 25+ industrial object types.
 * M7.1 — Digital Plant Builder.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { callVisionAi, parseVisionJson } from '@/services/ai/VisionAiService';
import { renderPagesAsImages } from '@/services/ai/PdfProcessor';
import { DigitalPlantService } from './DigitalPlantService';

// ── Comprehensive extraction prompt ────────────────

const PLANT_EXTRACTION_PROMPT = `
You are analysing an engineering drawing from an industrial facility (refinery, petrochemical, power plant).
Extract ALL identifiable tagged objects.

EXTRACT THESE TYPES:

EQUIPMENT:
  E-xxx / HE-xxx = Heat Exchanger
  EA-xxx = Air Cooler / Air-Fin
  P-xxx = Pump
  V-xxx = Vessel
  T-xxx = Tank
  K-xxx = Compressor
  C-xxx = Column / Tower
  FN-xxx = Fan
  R-xxx = Reactor
  DR-xxx = Drum
  F-xxx / H-xxx = Fired Heater / Furnace
  FI-xxx = Filter

ROTATING EQUIPMENT:
  M-xxx = Motor
  GT-xxx = Gas Turbine
  ST-xxx = Steam Turbine

VALVES:
  FV-xxx = Flow Control Valve
  HV-xxx = Hand Valve
  XV-xxx = Solenoid/Shutdown Valve
  PV-xxx = Pressure Control Valve
  LV-xxx = Level Control Valve
  TV-xxx = Temperature Control Valve
  CV-xxx = Check Valve
  PSV-xxx / RV-xxx = Pressure Safety/Relief Valve
  BDV-xxx = Blowdown Valve
  SDV-xxx = Shutdown Valve
  BV-xxx = Ball Valve
  GV-xxx = Gate Valve
  GLV-xxx = Globe Valve

INSTRUMENTS:
  FIC-xxx / FT-xxx / FE-xxx = Flow
  LIC-xxx / LT-xxx / LE-xxx = Level
  PIC-xxx / PT-xxx / PE-xxx = Pressure
  TIC-xxx / TT-xxx / TE-xxx = Temperature
  AIC-xxx / AT-xxx / AE-xxx = Analyser
  ZSH/ZSL/ZI = Position / Limit Switch

PIPELINES:
  Format: SIZE"-SERVICE-SEQ-SPEC (e.g. "6\\"-FW-1042-A1A")

NOZZLES:
  N1, N2, NA, NB format on equipment

TITLE BLOCK: drawing_number, drawing_title, revision, unit_area (if visible)

For each item, provide:
- item_type: one of [equipment, pump, compressor, column, vessel, tank, heat_exchanger, air_cooler, reactor, heater, filter, motor, turbine, valve, psv, instrument, pipeline, nozzle, other]
- tag_number: exact tag as readable (e.g. "P-1001A", "FV-2003", "6\\"-FW-1042-A1A")
- description: brief description or service note if visible
- confidence: high | medium | low
- source_page: page number
- attributes: {
    manufacturer?, model?, size?, rating?, material?, class?, service?,
    connected_to? (for nozzles/valves), nominal_size?, set_pressure? (for PSVs)
  }

Return ONLY valid JSON:
{
  "drawing_number": string | null,
  "drawing_title": string | null,
  "revision": string | null,
  "unit_area": string | null,
  "items": [
    {
      "item_type": string,
      "tag_number": string,
      "description": string | null,
      "confidence": "high"|"medium"|"low",
      "source_page": number,
      "attributes": {}
    }
  ]
}
`;

// ── Types ──────────────────────────────────────────

type RawExtraction = {
  drawing_number: string | null;
  drawing_title: string | null;
  revision: string | null;
  unit_area: string | null;
  items: Array<{
    item_type: string;
    tag_number: string;
    description: string | null;
    confidence: string;
    source_page: number;
    attributes: Record<string, unknown>;
  }>;
};

export type ExtractionResult = {
  job_id: string;
  document_id: string;
  drawing_number: string | null;
  candidate_count: number;
  candidates_by_type: Record<string, number>;
};

export type ListCandidatesInput = {
  organizationId: string;
  projectId: string;
  status?: string;
  candidateType?: string;
  documentId?: string;
  minConfidence?: number;
  search?: string;
  page?: number;
  pageSize?: number;
};

// ── Service ────────────────────────────────────────

export class ExtractionService {
  /**
   * Extract objects from a PlantDocument using AI vision.
   * Creates ExtractionCandidate rows — never auto-approves.
   */
  static async extractFromDocument(
    organizationId: string,
    projectId: string,
    documentId: string,
    userId: string
  ): Promise<ExtractionResult> {
    const doc = await prisma.plantDocument.findFirst({
      where: { id: documentId, organization_id: organizationId, deleted_at: null },
    });
    if (!doc) throw new Error('Document not found');

    // Update document status
    await prisma.plantDocument.update({
      where: { id: documentId },
      data: { status: 'extracting' },
    });

    // Create AI extraction job (reuse existing model)
    const job = await prisma.aiExtractionJob.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        site_id: null,
        requested_by: userId,
        status: 'processing',
        work_type_hint: 'digital_plant_extraction',
        started_at: new Date(),
      },
    });

    try {
      // Render document pages as images
      const pageNumbers = Array.from({ length: doc.page_count ?? 1 }, (_, i) => i + 1);
      const rendered = await renderPagesAsImages(doc.storage_path, pageNumbers, 1.5);
      const images = rendered.map((p) => ({
        base64: p.image_base64,
        mimeType: 'image/png' as const,
      }));

      // Call vision AI
      const result = await callVisionAi({
        organization_id: organizationId,
        prompt: PLANT_EXTRACTION_PROMPT,
        images,
        max_tokens: 8192,
        temperature: 0.1,
      });

      const parsed = parseVisionJson<RawExtraction>(result.content);

      // Check for existing tags in Asset table
      const allTags = (parsed.items ?? []).map((i) => i.tag_number);
      const existing = await prisma.asset.findMany({
        where: { organization_id: organizationId, tag_number: { in: allTags } },
        select: { tag_number: true, id: true },
      });
      const existingMap = new Map(existing.map((e) => [e.tag_number, e.id]));

      // Create ExtractionCandidate rows (NEVER auto-approved)
      const candidates = (parsed.items ?? []).map((item) => ({
        id: randomUUID(),
        organization_id: organizationId,
        project_id: projectId,
        source_document_id: documentId,
        extraction_job_id: job.id,
        candidate_type: item.item_type || 'other',
        tag_number: item.tag_number,
        description: item.description,
        confidence_score: item.confidence === 'high' ? 0.9 : item.confidence === 'medium' ? 0.7 : 0.4,
        extracted_attributes: {
          ...item.attributes,
          already_exists: existingMap.has(item.tag_number),
          existing_asset_id: existingMap.get(item.tag_number) || null,
          drawing_number: parsed.drawing_number,
          drawing_title: parsed.drawing_title,
          unit_area: parsed.unit_area,
        },
        source_page: item.source_page ?? 1,
        status: 'pending_review' as const,
      }));

      if (candidates.length > 0) {
        await prisma.extractionCandidate.createMany({ data: candidates });
      }

      // Update job status
      await prisma.aiExtractionJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completed_at: new Date(),
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
        },
      });

      // Store extraction result
      await prisma.aiExtractionResult.create({
        data: {
          id: randomUUID(),
          organization_id: organizationId,
          ai_extraction_job_id: job.id,
          raw_ai_response: result.content,
          extracted_data_json: { items: parsed.items, drawing_number: parsed.drawing_number } as object,
          review_status: 'pending_review',
          overall_confidence:
            candidates.length > 0
              ? candidates.reduce((sum, c) => sum + (c.confidence_score ?? 0), 0) / candidates.length
              : 0,
        },
      });

      // Update document status
      await prisma.plantDocument.update({
        where: { id: documentId },
        data: { status: 'extracted' },
      });

      // Increment project counter
      await DigitalPlantService.incrementCounters(projectId, 'total_candidates', candidates.length);

      // Group by type for summary
      const byType: Record<string, number> = {};
      candidates.forEach((c) => {
        byType[c.candidate_type] = (byType[c.candidate_type] || 0) + 1;
      });

      return {
        job_id: job.id,
        document_id: documentId,
        drawing_number: parsed.drawing_number ?? null,
        candidate_count: candidates.length,
        candidates_by_type: byType,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.aiExtractionJob.update({
        where: { id: job.id },
        data: { status: 'failed', completed_at: new Date(), error_message: msg },
      });
      await prisma.plantDocument.update({
        where: { id: documentId },
        data: { status: 'uploaded' },
      });
      throw e;
    }
  }

  /**
   * List extraction candidates with filtering and pagination.
   */
  static async listCandidates(input: ListCandidatesInput) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 100);

    const where: any = {
      organization_id: input.organizationId,
      project_id: input.projectId,
    };
    if (input.status) where.status = input.status;
    if (input.candidateType) where.candidate_type = input.candidateType;
    if (input.documentId) where.source_document_id = input.documentId;
    if (input.minConfidence) where.confidence_score = { gte: input.minConfidence };
    if (input.search) {
      where.OR = [
        { tag_number: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.extractionCandidate.findMany({
        where,
        include: {
          source_document: { select: { id: true, drawing_number: true, title: true, document_type: true } },
        },
        orderBy: [{ status: 'asc' }, { confidence_score: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.extractionCandidate.count({ where }),
    ]);

    return { data: items, total, page, pageSize };
  }

  /**
   * Get a single candidate with full detail.
   */
  static async getCandidate(organizationId: string, candidateId: string) {
    return prisma.extractionCandidate.findFirst({
      where: { id: candidateId, organization_id: organizationId },
      include: {
        source_document: true,
        review_actions: { orderBy: { created_at: 'desc' } },
      },
    });
  }
}
