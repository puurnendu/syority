import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { extractPdfText } from '@/lib/ai/aiHelpers';
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
function mapAiResponseToSystemFields(raw: any): any {
    if (!raw || typeof raw !== 'object') return raw;

    const mapped = JSON.parse(JSON.stringify(raw)); // Clone

    const sectionMappings: Record<string, Record<string, string>> = {
        dimensions: {
            shell_id: 'shell_id_mm',
            shellId: 'shell_id_mm',
            overall_length: 'overall_length_mm',
            overallLength: 'overall_length_mm',
            tube_length: 'tube_length_mm',
            tubeLength: 'tube_length_mm',
            heat_surface: 'heat_surface_area_m2',
            heatSurface: 'heat_surface_area_m2',
            weight_dry: 'weight_dry_kg',
            weightDry: 'weight_dry_kg',
            weight_operating: 'weight_operating_kg',
            weightOperating: 'weight_operating_kg',
            weight_flooded: 'weight_flooded_kg',
            weightFlooded: 'weight_flooded_kg',
        },
        tube_bundle: {
            tube_od: 'tube_od_mm',
            tubeOD: 'tube_od_mm',
            tube_thickness: 'tube_thickness_mm',
            tubeThickness: 'tube_thickness_mm',
        },
        shell_side: {
            inlet_temp: 'inlet_temp_c',
            inletTemp: 'inlet_temp_c',
            outlet_temp: 'outlet_temp_c',
            outletTemp: 'outlet_temp_c',
            design_pressure: 'design_pressure_kg_cm2',
            designPressure: 'design_pressure_kg_cm2',
            test_pressure: 'test_pressure_kg_cm2',
            testPressure: 'test_pressure_kg_cm2',
            design_temp: 'design_temp_c',
            designTemp: 'design_temp_c',
            pressure_drop: 'pressure_drop_kg_cm2',
            pressureDrop: 'pressure_drop_kg_cm2',
            velocity: 'velocity_m_s',
        },
        tube_side: {
            inlet_temp: 'inlet_temp_c',
            inletTemp: 'inlet_temp_c',
            outlet_temp: 'outlet_temp_c',
            outletTemp: 'outlet_temp_c',
            design_pressure: 'design_pressure_kg_cm2',
            designPressure: 'design_pressure_kg_cm2',
            test_pressure: 'test_pressure_kg_cm2',
            testPressure: 'test_pressure_kg_cm2',
            design_temp: 'design_temp_c',
            designTemp: 'design_temp_c',
            pressure_drop: 'pressure_drop_kg_cm2',
            pressureDrop: 'pressure_drop_kg_cm2',
            velocity: 'velocity_m_s',
        }
    };

    for (const [section, mappings] of Object.entries(sectionMappings)) {
        if (mapped[section] && typeof mapped[section] === 'object') {
            const sectionData = mapped[section];
            for (const [aiKey, systemKey] of Object.entries(mappings)) {
                if (systemKey in sectionData) continue; // Priority already correct
                if (aiKey in sectionData) {
                    sectionData[systemKey] = sectionData[aiKey];
                    // Keep original for safety if needed, or remove to clean up
                }
            }
        }
    }

    return mapped;
}


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

        const extractedData = mapAiResponseToSystemFields(rawData);
        console.log('[ExtractTechnicalData] Mapping applied. Final payload keys:', Object.keys(extractedData as object));

        // PERSIST: Save the extracted results to the workpack
        await prisma.workpack.update({
            where: { id: workpackId },
            data: { 
              equipment_technical_data: extractedData as any,
              updated_at: new Date()
            }
        });

        console.log('[ExtractTechnicalData] Success. Data saved to DB.');

        return NextResponse.json({ data: extractedData });
    } catch (err: any) {
        console.error('[ExtractTechnicalData] Error:', err);
        return NextResponse.json(
            { error: 'Failed to extract technical data. Please check logs and AI configuration.' },
            { status: 500 }
        );
    }
});
