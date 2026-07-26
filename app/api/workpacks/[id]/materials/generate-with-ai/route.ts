import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { DISCIPLINE_KEYS_FOR_AI } from '@/lib/materials/disciplines';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import path from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

const MATERIAL_CATEGORIES = [
  'Gaskets',
  'Bolts & Nuts',
  'Blind Gaskets',
  'Welding Consumables',
  'Cleaning Consumables',
  'Inspection Materials',
  'Misc',
  'Chemicals',
];

function buildMaterialPrompt(params: {
  equipmentTag: string;
  equipmentType: string;
  scopeHint: string;
  jointsJson: string;
  blindsJson: string;
  activitiesJson: string;
  documentText: string;
}) {
  const { equipmentTag, equipmentType, scopeHint, jointsJson, blindsJson, activitiesJson, documentText } = params;
  return `You are an expert mechanical engineer specialising in plant maintenance and turnaround planning.

Generate a complete material list for this maintenance workpack:

Equipment: ${equipmentTag || '(not specified)'} — ${equipmentType || 'Equipment'}
Scope: ${scopeHint || '(no scope hint)'}

ENGINEERING DOCUMENTS:
${documentText}

Extract materials from documents above where possible (gasket specs, bolt materials, coatings, etc.).

Joint data:
${jointsJson || '[]'}

Blind data:
${blindsJson || '[]'}

Activities:
${activitiesJson || '[]'}

Generate ALL materials required including:

1. GASKETS — one per joint, based on joint size, rating, gasket type
   - Part description: e.g. "Spiral Wound Gasket 14 inch Class 600 304SS+Graphite"
   - Quantity: 1 per joint (plus 10% spare for critical joints)
   - Spec: ASME B16.20

2. BOLTS & NUTS — per joint based on flange size and rating
   - Use standard bolt count table (e.g. 14 inch Class 600 = 20 bolts)
   - Material: A193 B7 studs / A194 2H nuts (unless spec says otherwise)
   - Description: "Stud Bolt M36x200 A193 B7 with 2x Nuts A194 2H"
   - Include 10% spare

3. BLIND GASKETS — one per blind in blind register

4. CONSUMABLES based on activities:
   - Welding: filler electrodes (E7018, ER70S-6 etc), grinding discs
   - Cleaning: rags, solvent, wire brushes, gasket scraper blades
   - Inspection: dye penetrant kit, marking paint
   - General: thread compound (Molykote/Jet-Lube), anti-seize paste

5. MISC MATERIALS:
   - Temporary blanking plugs / caps
   - Plastic sheeting / protection material
   - Hydraulic tensioner oil (if tensioning method used)
   - Torque wrench calibration seals

For EACH material you MUST include a "discipline" field. Choose the single most appropriate from: ${DISCIPLINE_KEYS_FOR_AI}
- mechanical: gaskets, bolts, studs, flanges, pipes, valves, bearings, seals, impellers, tube bundles
- electrical: cables, extension cords, flood lights, grinding machines, hand lamps, electric tools
- instrumentation: pressure gauges, thermometers, transmitters, control valves, flow meters
- consumable: cleaning agents, flushing oil, nitrogen, desiccant, rags, gloves, thread tape, anti-seize
- scaffolding: scaffolding tubes, planks, couplers, safety nets, toe boards
- insulation: mineral wool, calcium silicate, aluminium jacketing, wire mesh
- painting: primer, topcoat, thinner, abrasive paper, wire brushes for surface prep
- civil: grout, cement, anchor bolts, expansion bolts

Return ONLY a valid JSON array, no other text or markdown:
[
  {
    "category": "Gaskets",
    "discipline": "mechanical",
    "itemCode": null,
    "description": "Spiral Wound Gasket 14 inch Class 600 304SS+Graphite ASME B16.20",
    "quantity": 2,
    "unit": "EA",
    "spec": "ASME B16.20",
    "linkedJointNo": "J-E435-001",
    "source": "joint",
    "notes": "Shell Inlet Nozzle N1 + 1 spare"
  }
]

CRITICAL JSON RULES:
- NEVER use the double-quote symbol (") inside any of your string values (e.g. for inside sizes, write "14 inch" instead of "14\"").
- Unescaped quotes inside strings will break the JSON parser. Strictly use double quotes ONLY to enclose keys and values.

Use "source" as: joint | blind | activity | misc
Use "unit" as: EA | M | KG | LTR | PKT | TIN | SET

IMPORTANT: Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation text. Start your response with [ and end with ].`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    let orgId: string;
    try {
      orgId = orgScope(session!).orgId;
    } catch (scopeErr) {
      return NextResponse.json(
        { error: 'No organization in session. Please log in again.' },
        { status: 400 }
      );
    }
    const { id: workpackId } = await context.params;

    const workpack = await prisma.workpack.findUnique({
      where: { id: workpackId },
      include: {
        asset: { select: { tag_number: true, name: true } },
        joint_integrity_items: {
          where: { deleted_at: null },
        },
        blinds: {
          where: { deleted_at: null },
        },
        activities: {
          where: { deleted_at: null },
          orderBy: { sequence_number: 'asc' },
        },
        documents: {
          where: { deleted_at: null },
        }
      },
    });

    if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const scopeHint = (body.scopeHint ?? workpack.scope_of_work ?? '').toString().trim();
    const equipmentType = (body.equipmentType ?? workpack.equipment_type ?? 'Equipment').toString();
    const equipmentTag = (body.equipmentTag ?? workpack.asset?.tag_number ?? workpack.asset?.name ?? '').toString().trim();

    // Aggregate text from documents
    const textParts: string[] = [];
    if (workpack.documents) {
      for (const doc of workpack.documents) {
        const filePath = doc.storage_path.startsWith('/') ? doc.storage_path : path.join(process.cwd(), doc.storage_path);
        if (existsSync(filePath)) {
          const text = await extractPdfText(filePath);
          textParts.push(`\n=== DOCUMENT: ${doc.original_filename} ===\n${text.substring(0, 15000)}`);
        }
      }
    }
    const documentText = textParts.join('\n\n') || "No documentation text available.";

    const prompt = buildMaterialPrompt({
      equipmentTag,
      equipmentType,
      scopeHint,
      jointsJson: JSON.stringify(workpack.joint_integrity_items, null, 2),
      blindsJson: JSON.stringify(workpack.blinds, null, 2),
      activitiesJson: JSON.stringify(workpack.activities, null, 2),
      documentText,
    });

    let items: any[] = [];
    try {
      const systemPrompt = 'You are a mechanical engineer. Return ONLY a valid JSON array. No markdown, no text, no explanations. Start with [ and end with ].';
      
      const aiResponse = await callVisionAI({
        orgId,
        workpackId,
        userPrompt: prompt,
        systemPrompt,
        maxTokens: 8000,
        context: {
          title: workpack.title,
          equipment_type: workpack.equipment_type,
          asset_tag: equipmentTag
        }
      });
      
      items = parseVisionJson(aiResponse, { expected: 'array' });
    } catch (err) {
      console.error('[MaterialsGen] AI error:', err);
      return NextResponse.json(
        { error: 'AI extraction service is temporarily unavailable. Please try again.' },
        { status: 500 }
      );
    }

    function inferDiscipline(description: string, category?: string): string {
  const d = (description ?? '').toLowerCase();
  const c = (category ?? '').toLowerCase();
  if (/gasket|bolt|stud|nut|washer|flange|pipe|valve|seal|bearing|impeller|tube sheet|shell|o\.ring/.test(d) || /gaskets|bolts|nuts/.test(c)) return 'mechanical';
  if (/cable|light|lamp|motor|switch|extension|grind|electrical|power/.test(d)) return 'electrical';
  if (/gauge|transmitter|sensor|instrument|controller|flow meter|thermowell/.test(d)) return 'instrumentation';
  if (/grease|lubricant|cleaning|solvent|desiccant|rag|cloth|tape|chemical|consumable/.test(d)) return 'consumable';
  if (/scaffold|plank|coupler|safety net|ledger/.test(d)) return 'scaffolding';
  if (/insulation|mineral wool|calcium silicate|jacket|clad/.test(d)) return 'insulation';
  if (/paint|primer|coat|thinner|abrasive|wire brush/.test(d)) return 'painting';
  if (/cement|grout|concrete|anchor/.test(d)) return 'civil';
  return 'mechanical';
}

    const materials = items
      .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
      .map((m) => {
        const desc = typeof m.description === 'string' ? m.description : String(m.description ?? '');
        const cat = typeof m.category === 'string' ? m.category : 'Misc';
        const disc = typeof m.discipline === 'string' && /^(mechanical|electrical|instrumentation|consumable|scaffolding|insulation|painting|civil)$/.test(m.discipline)
          ? m.discipline
          : inferDiscipline(desc, cat);
        return {
          category: cat,
          discipline: disc,
          itemCode: m.itemCode != null ? String(m.itemCode) : null,
          description: desc,
          quantity: typeof m.quantity === 'number' ? m.quantity : Number(m.quantity) || 1,
          unit: typeof m.unit === 'string' ? m.unit : 'EA',
          spec: m.spec != null ? String(m.spec) : null,
          linkedJointNo: m.linkedJointNo != null ? String(m.linkedJointNo) : null,
          source: typeof m.source === 'string' ? m.source : 'misc',
          notes: m.notes != null ? String(m.notes) : null,
        };
      });

    const autoSave = body.autoSave === true;
    const regenerate = body.regenerate === true;
    if (autoSave && materials.length > 0) {
      if (regenerate) {
        await prisma.workpackMaterialLine.deleteMany({
          where: { workpack_id: workpackId, organization_id: orgId, ai_generated: true },
        });
      }
      let created = 0;
      for (const m of materials) {
        if (!m.description?.trim()) continue;
        await prisma.workpackMaterialLine.create({
          data: {
            organization_id: orgId,
            workpack_id: workpackId,
            source_type: 'ai',
            source_id: null,
            category: m.category || null,
            material_category: m.discipline ?? 'mechanical',
            linked_to: m.linkedJointNo?.trim() || null,
            item_code: m.itemCode?.trim() || null,
            description: m.description,
            specification: m.spec?.trim() || null,
            unit_of_measure: (m.unit || 'EA').toString().trim() || 'EA',
            quantity_required: typeof m.quantity === 'number' ? m.quantity : 1,
            procurement_status: 'not_requested',
            ai_generated: true,
            includedInPdf: true,
            notes: m.notes?.trim() || null,
          },
        });
        created++;
      }
      return NextResponse.json({ saved: true, count: created, created });
    }

    return NextResponse.json({
      items: materials,
      materials,
      count: materials.length,
    });
  } catch (err) {
    console.error('[MATERIALS GENERATE] FATAL ERROR:', err);
    console.error('[MATERIALS GENERATE] Stack:', err instanceof Error ? err.stack : err);
    return NextResponse.json(
      { error: 'AI extraction service is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
