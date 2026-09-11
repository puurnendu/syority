import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import { AssetRegisterService, AssetExtractionMapper } from '@/core/asset-register';
import path from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

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
 * Normalizes common AI naming variations to match the system field names.
 * Example: shell_id -> shell_id_mm
 */
// Inline mapper functions removed — now using shared AssetExtractionMapper
// (AssetExtractionMapper.normalizeAiResponse + AssetExtractionMapper.fromAiResponse)


export const POST = withTenantGuard(async (req, { params }, session) => {
    const { id: workpackId } = await params;
    const { equipmentTag } = await req.json();

    try {
        const { error } = await guardApi('workpacks.manage');
        if (error) return error;

        const orgId = session.user.organization_id;
        await assertTenantAccess('workpack', workpackId, orgId);

        const workpack = await prisma.workpack.findUnique({
            where: { id: workpackId },
            include: { documents: true }
        });

        if (!workpack) {
            return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
        }

        console.log(`[ExtractTechnicalData] Starting extraction for Workpack ${workpackId}`);

        // Aggregate text from all PDFs
        const textParts: string[] = [];
        if (workpack.documents) {
            for (const doc of workpack.documents) {
                let filePath = '';
                const possiblePaths = [
                    doc.storage_path.startsWith('/') ? doc.storage_path : '',
                    path.join(process.cwd(), 'public', doc.storage_path),
                    path.join(process.cwd(), doc.storage_path)
                ].filter(Boolean);

                for (const p of possiblePaths) {
                    if (existsSync(p)) {
                        filePath = p;
                        break;
                    }
                }
                
                if (filePath) {
                    console.log(`[ExtractTechnicalData] Reading document: ${doc.original_filename}`);
                    const text = await extractPdfText(filePath);
                    if (text) {
                        textParts.push(`\n--- START DOCUMENT: ${doc.original_filename} ---\n${text}\n--- END DOCUMENT: ${doc.original_filename} ---`);
                    }
                }
            }
        }
        
        const rawText = textParts.join('\n\n');
        
        // Quality Check: Ensure we have enough data to proceed
        console.log(`[ExtractTechnicalData] Total input text length: ${rawText.length}`);
        if (rawText.length < 200) {
            console.warn('[ExtractTechnicalData] Insufficient data. Skipping AI call.');
            return NextResponse.json({ 
                error: 'Insufficient document data for extraction. Please ensure you have uploaded a valid PDF datasheet.',
                warning: true 
            }, { status: 400 });
        }

        // Preview for logs
        console.log('[ExtractTechnicalData] Input text preview (first 500 chars):', rawText.substring(0, 500).replace(/\n/g, ' '));

        const documentText = `TECHNICAL SPECIFICATIONS / DESIGN DATA EXTRACTED FROM DOCUMENTS:\n\n${rawText}`;

        // Use the centralized VisionAIService
        const prompt = buildExtractionPrompt(equipmentTag);
        const aiResponse = await callVisionAI({
            orgId: workpack.organization_id,
            workpackId,
            input: documentText, // PASS THE ACTUAL CONTENT HERE
            userPrompt: prompt,
            systemPrompt: 'You are a technical data extraction specialist. Return structured JSON only.',
            context: {
                title: workpack.title,
                equipment_type: workpack.equipment_type,
                asset_tag: equipmentTag
            }
        });

        console.log('[ExtractTechnicalData] Raw response from AI:', aiResponse);

        const rawData = parseVisionJson(aiResponse);
        console.log('[ExtractTechnicalData] Parsed result keys:', Object.keys(rawData as object));

        const extractedData = AssetExtractionMapper.normalizeAiResponse(rawData);
        console.log('[ExtractTechnicalData] Mapping applied. Final payload keys:', Object.keys(extractedData as object));

        // PERSIST: Save the extracted results to the workpack
        await prisma.workpack.update({
            where: { id: workpackId },
            data: { 
              equipment_technical_data: extractedData as any,
              updated_at: new Date()
            }
        });

        console.log('[ExtractTechnicalData] Success. Data saved to DB (legacy JSON).');

        // ─────────────────────────────────────────────────────────────────────
        // M8.6 PARALLEL WRITE — Asset Register EAV Layer
        // Write extracted values to AssetAttributeValue + AssetAttributeHistory.
        // AI protection rule: verified values are NEVER overwritten (R2.1).
        // ─────────────────────────────────────────────────────────────────────
        if (workpack.asset_id) {
          try {
            const flatValues = AssetExtractionMapper.flattenExtractedData(extractedData);
            if (flatValues.length > 0) {
              await AssetRegisterService.batchSetAttributeValues(
                workpack.asset_id,
                flatValues,
                {
                  organization_id: workpack.organization_id,
                  user_id: session.user.id,
                  source_type: 'ai_extraction',
                  ai_model: 'gemini-2.5-pro',
                  reason: `AI extraction from workpack ${workpackId}`,
                }
              );
              console.log(`[ExtractTechnicalData] M8.6 parallel write: ${flatValues.length} attribute values written to Asset Register.`);
            }
          } catch (regErr: any) {
            // Asset Register write failure should NOT break the extraction
            console.error('[ExtractTechnicalData] M8.6 parallel write failed (non-fatal):', regErr.message);
          }
        }

        return NextResponse.json({ data: extractedData });
    } catch (err: any) {
        console.error('[ExtractTechnicalData] Error:', err);
        return NextResponse.json(
            { error: 'Failed to extract technical data. Please check logs and AI configuration.' },
            { status: 500 }
        );
    }
});
