/**
 * P&ID extraction: equipment tags, line numbers, valve/instrument tags
 * from P&ID drawing pages. Uses work_type_hint = 'pid_extraction'.
 * Output drives Asset + LineList creation after review.
 */

import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { callVisionAi, parseVisionJson } from '@/services/ai/VisionAiService';
import { renderPagesAsImages } from '@/services/ai/PdfProcessor';
import { prisma } from '@/lib/prisma';

export type PidExtractedItem = {
  item_type: 'equipment' | 'line' | 'valve' | 'instrument' | 'other';
  tag_number: string;
  description: string | null;
  confidence: 'high' | 'medium' | 'low';
  source_page: number;
  already_exists: boolean;
};

export type PidExtractionResult = {
  job_id: string;
  drawing_number: string | null;
  drawing_title: string | null;
  revision: string | null;
  unit_area: string | null;
  items: PidExtractedItem[];
  equipment_count: number;
  line_count: number;
};

const PID_EXTRACTION_PROMPT = `
You are analysing a P&ID (Piping and Instrumentation Diagram) drawing. Extract ALL identifiable tags.

EXTRACT:
1. Equipment tags (E-xxx, P-xxx, V-xxx, T-xxx, K-xxx, C-xxx, FN-xxx, HE-xxx)
2. Line numbers (size"-service-seq-spec format, e.g. "6\\"-FW-1042-A1A", "4\\"-PW-1043-B2B")
3. Valve tags (FV-xxx, HV-xxx, XV-xxx, PV-xxx, LV-xxx, TV-xxx)
4. Instrument tags (FIC-xxx, LT-xxx, PT-xxx, TT-xxx, FT-xxx)

TITLE BLOCK (if visible): drawing_number, drawing_title, revision, unit_area

EQUIPMENT TYPE from tag prefix: E=heat exchanger, EA=air cooler, P=pump, V=vessel, T=tank, K=compressor, C=column, FN=fan.

CONFIDENCE: high=clearly readable, medium=partially obscured, low=uncertain.

Return ONLY valid JSON:
{
  "drawing_number": string | null,
  "drawing_title": string | null,
  "revision": string | null,
  "unit_area": string | null,
  "items": [
    {
      "item_type": "equipment"|"line"|"valve"|"instrument",
      "tag_number": string,
      "description": string | null,
      "confidence": "high"|"medium"|"low",
      "source_page": number
    }
  ]
}
`;

function isImagePath(storagePath: string, mimeType?: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  const ext = extname(storagePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
}

async function loadVisionImages(
  storagePathOrPaths: string | string[],
  pageNumbers: number[],
  mimeType?: string
): Promise<Array<{ base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }>> {
  const paths = Array.isArray(storagePathOrPaths) ? storagePathOrPaths : [storagePathOrPaths];

  if (paths.length > 1 || isImagePath(paths[0], mimeType)) {
    const images: Array<{ base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }> = [];
    for (const storagePath of paths) {
      const buf = await readFile(storagePath);
      const mt =
        mimeType === 'image/jpeg' || mimeType === 'image/webp'
          ? mimeType
          : storagePath.toLowerCase().endsWith('.jpg') || storagePath.toLowerCase().endsWith('.jpeg')
            ? 'image/jpeg'
            : 'image/png';
      images.push({ base64: buf.toString('base64'), mimeType: mt });
    }
    return images;
  }

  const rendered = await renderPagesAsImages(paths[0], pageNumbers, 1.5);
  return rendered.map((p) => ({
    base64: p.image_base64,
    mimeType: 'image/png' as const,
  }));
}

export async function extractFromPAndId(
  organizationId: string,
  siteId: string,
  unitId: string,
  sourceDocumentId: string,
  storagePathOrPaths: string | string[],
  pageNumbers: number[],
  requestedBy: string,
  mimeType?: string
): Promise<PidExtractionResult> {
  const now = new Date();
  const job = await prisma.aiExtractionJob.create({
    data: {
      id: randomUUID(),
      organization_id: organizationId,
      site_id: siteId,
      requested_by: requestedBy,
      status: 'processing' as const,
      work_type_hint: 'pid_extraction',
      started_at: now,
      updated_at: now,
    },
  });

  try {
    const images = await loadVisionImages(storagePathOrPaths, pageNumbers, mimeType);
    if (images.length === 0) {
      throw new Error('No pages could be rendered from the uploaded file');
    }

    const result = await callVisionAi({
      organization_id: organizationId,
      prompt: PID_EXTRACTION_PROMPT,
      images,
      max_tokens: 4096,
      temperature: 0.1,
    });

    type RawResult = {
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
      }>;
    };

    const parsed = parseVisionJson<RawResult>(result.content);

    const assetItemTypes = new Set(['equipment', 'valve', 'instrument']);
    const assetTags = (parsed.items ?? [])
      .filter((i) => assetItemTypes.has(i.item_type))
      .map((i) => i.tag_number.trim().toUpperCase());
    const lineNumbers = (parsed.items ?? [])
      .filter((i) => i.item_type === 'line')
      .map((i) => i.tag_number.trim());

    const [existingAssets, existingLines] = await Promise.all([
      assetTags.length
        ? prisma.asset.findMany({
            where: {
              organization_id: organizationId,
              tag_number: { in: assetTags },
            },
            select: { tag_number: true },
          })
        : Promise.resolve([]),
      lineNumbers.length
        ? prisma.line_lists.findMany({
            where: {
              organization_id: organizationId,
              line_number: { in: lineNumbers },
            },
            select: { line_number: true },
          })
        : Promise.resolve([]),
    ]);
    const existingAssetSet = new Set(existingAssets.map((e) => e.tag_number.toUpperCase()));
    const existingLineSet = new Set(existingLines.map((e) => e.line_number));

    const items: PidExtractedItem[] = (parsed.items ?? []).map((i) => {
      const tagNorm = i.tag_number.trim();
      const alreadyExists = assetItemTypes.has(i.item_type)
        ? existingAssetSet.has(tagNorm.toUpperCase())
        : i.item_type === 'line'
          ? existingLineSet.has(tagNorm)
          : false;
      return {
        item_type: i.item_type as PidExtractedItem['item_type'],
        tag_number: tagNorm,
        description: i.description,
        confidence: (i.confidence as PidExtractedItem['confidence']) ?? 'low',
        source_page: i.source_page ?? 1,
        already_exists: alreadyExists,
      };
    });

    await prisma.aiExtractionResult.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        ai_extraction_job_id: job.id,
        raw_ai_response: result.content,
        extracted_data_json: {
          drawing_number: parsed.drawing_number,
          drawing_title: parsed.drawing_title,
          revision: parsed.revision,
          unit_area: parsed.unit_area,
          items,
          source_document_id: sourceDocumentId,
          unit_id: unitId || null,
        } as object,
        review_status: 'pending_review',
        overall_confidence:
          items.length > 0
            ? items.filter((i) => i.confidence === 'high').length / items.length
            : 0,
        updated_at: now,
      },
    });

    await prisma.aiExtractionJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completed_at: new Date(),
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
      },
    });

    return {
      job_id: job.id,
      drawing_number: parsed.drawing_number ?? null,
      drawing_title: parsed.drawing_title ?? null,
      revision: parsed.revision ?? null,
      unit_area: parsed.unit_area ?? null,
      items,
      equipment_count: items.filter((i) => i.item_type === 'equipment').length,
      line_count: items.filter((i) => i.item_type === 'line').length,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.aiExtractionJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        completed_at: new Date(),
        error_message: msg,
      },
    });
    throw e;
  }
}
