/**
 * GET  /api/assets/[assetId]/extract — Get AI extraction status & pending extractions for asset
 * POST /api/assets/[assetId]/extract — Trigger AI extraction from linked plant documents
 *
 * Uses the existing Vision AI + AssetExtractionMapper pipeline.
 * Does NOT create a duplicate AI engine.
 *
 * Tenant-scoped via orgScope + asset ownership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AssetRegisterService, AssetExtractionMapper } from '@/core/asset-register';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import path from 'path';
import { existsSync } from 'fs';

function buildExtractionPrompt(equipmentTag: string) {
  return `You are a mechanical engineering document analyst.
Extract ALL technical data from the provided TECHNICAL SPECIFICATIONS / DESIGN DATA.

Equipment tag: ${equipmentTag || '(not specified)'}

STRICT INSTRUCTIONS:
- Extract values ONLY if explicitly present in the input. Do NOT assume, calculate from unrelated fields, or hallucinate values.
- If data is missing for a field, return null. 
- If units are present in the document, convert/standardize the value to the requested unit in the key name (mm, kg, °C, kg/cm², m/s, m²) where applicable.
- Return numeric values as numbers where possible.

Required JSON structure and keys:
- equipment: { name, type, tema_designation, manufacturer, serial_number }
- dimensions: { shell_id_mm, overall_length_mm, tube_length_mm, heat_surface_area_m2, weight_dry_kg, weight_operating_kg, weight_flooded_kg }
- tube_bundle: { total_tubes, tube_passes, tube_od_mm, tube_thickness_mm, tube_arrangement, baffle_type }
- shell_side, tube_side: { medium, flow_rate, inlet_temp_c, outlet_temp_c, design_pressure_kg_cm2, test_pressure_kg_cm2, design_temp_c, pressure_drop_kg_cm2, velocity_m_s, passes }
- hydrotest: { shellSideTestPressure, tubeSideTestPressure, testMedium, testDuration, testStandard, holdPressure }
- materials, nozzles, design_codes

Return the JSON object using EXACTLY these top-level key names. Do not rename, camelCase, or abbreviate keys.

Output format: VALID JSON OBJECT ONLY. No markdown, no prefixes, no backticks.`;
}

/**
 * GET — Status endpoint for AI extractions and current verified/candidate values
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: verify asset ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true, tag_number: true, name: true, asset_type: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Get current attribute values + pending AI extractions
    const [currentValues, pendingExtractions] = await Promise.all([
      AssetRegisterService.getAttributeValues(assetId, orgId),
      AssetRegisterService.getPendingAiExtractions(assetId, orgId),
    ]);

    return NextResponse.json({
      data: {
        asset: { id: asset.id, tag_number: asset.tag_number, name: asset.name, asset_type: asset.asset_type },
        current_values: currentValues,
        pending_extractions: pendingExtractions,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/assets/[assetId]/extract]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch extraction status' }, { status: 500 });
  }
}

/**
 * POST — Trigger AI extraction on linked documents for this asset
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: verify asset ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      include: {
        asset_document_links: {
          include: { document: true },
        },
      },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const linkedDocs = asset.asset_document_links?.map(l => l.document).filter(Boolean) || [];

    if (linkedDocs.length === 0) {
      return NextResponse.json(
        { error: 'No linked documents found for this asset to extract technical data from' },
        { status: 400 }
      );
    }

    // Extract text from linked document PDFs
    const textParts: string[] = [];
    for (const doc of linkedDocs) {
      if (doc.ai_text_extracted) {
        textParts.push(`\n--- START DOCUMENT: ${doc.original_filename} ---\n${doc.ai_text_extracted}\n--- END DOCUMENT: ${doc.original_filename} ---`);
        continue;
      }

      const possiblePaths = [
        doc.storage_path.startsWith('/') ? doc.storage_path : '',
        path.join(process.cwd(), 'public', doc.storage_path),
        path.join(process.cwd(), doc.storage_path),
      ].filter(Boolean);

      for (const p of possiblePaths) {
        if (existsSync(p)) {
          const text = await extractPdfText(p);
          if (text) {
            textParts.push(`\n--- START DOCUMENT: ${doc.original_filename} ---\n${text}\n--- END DOCUMENT: ${doc.original_filename} ---`);
          }
          break;
        }
      }
    }

    const rawText = textParts.join('\n\n');
    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Insufficient text content in linked documents for AI extraction' },
        { status: 422 }
      );
    }

    const prompt = buildExtractionPrompt(asset.tag_number);
    const aiResponse = await callVisionAI({ input: rawText, systemPrompt: prompt, orgId, workpackId: '' });
    const rawData = parseVisionJson(aiResponse);
    const normalizedData = AssetExtractionMapper.normalizeAiResponse(rawData);
    const flatValues = AssetExtractionMapper.flattenExtractedData(normalizedData);

    let savedAttributes: any[] = [];
    if (flatValues.length > 0) {
      savedAttributes = await AssetRegisterService.batchSetAttributeValues(
        asset.id,
        flatValues,
        {
          organization_id: orgId,
          user_id: session!.user.id,
          source_type: 'ai_extraction',
          ai_model: 'gemini-2.5-pro',
          reason: `AI extraction from linked documents for asset ${asset.tag_number}`,
        }
      );
    }

    return NextResponse.json({
      data: {
        asset_id: asset.id,
        extracted_attributes_count: flatValues.length,
        normalized_data: normalizedData,
        saved_attributes: savedAttributes,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('[POST /api/assets/[assetId]/extract]', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger extraction' }, { status: 500 });
  }
}
