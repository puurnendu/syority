import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import path from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

function buildToolPrompt(params: {
  equipmentTag: string;
  equipmentType: string;
  scopeOfWork: string;
  documentText: string;
}) {
  const { equipmentTag, equipmentType, scopeOfWork, documentText } = params;
  return `Generate a tools and equipment list for this workpack.

Equipment: ${equipmentTag || '(not specified)'} - ${equipmentType || 'Equipment'}
Scope: ${(scopeOfWork || '').substring(0, 300) ?? 'General STO maintenance'}

ENGINEERING DOCUMENTS:
${documentText}

JSON array, each item:
{"category":"Rigging","name":"Mobile Crane 25T","description":"Bundle extraction","quantity":1,"unit":"EA","toolType":"Hired","certRequired":true,"certType":"Lifting Certificate"}

Rules:
- Scaffolding: quantity=null, unit="m2"
- toolType: Owned/Hired/Special only
- certRequired true for: cranes, pressure test equipment, scaffolding
- Generate exactly 12 tools. No more.
- Use document data where relevant (lifting loads, equipment weights, etc.).

IMPORTANT: Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation text. Start your response with [ and end with ].`;
}



// AI can return these; only enum values can be stored in DB
const VALID_CATEGORIES = [
  'Rigging', 'Lifting', 'Scaffolding', 'Hand Tools', 'Power Tools', 'Inspection',
  'Safety', 'Cleaning', 'Measurement', 'Access', 'Mechanical', 'Electrical',
  'Hydraulic', 'Welding', 'General',
];

// ToolCategory enum in schema — only these are valid for Prisma
const DB_CATEGORIES = [
  'Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Hydraulic',
  'Measurement', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General',
] as const;
type DbCategory = (typeof DB_CATEGORIES)[number];

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

    const equipmentTag = (body.equipmentTag ?? workpack.asset?.tag_number ?? workpack.asset?.name ?? '').toString().trim();
    const equipmentType = (body.equipmentType ?? workpack.equipment_type ?? 'Equipment').toString();
    const scopeOfWork = (body.scopeOfWork ?? workpack.scope_of_work ?? workpack.title ?? '').toString().trim();

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

    const prompt = buildToolPrompt({
      equipmentTag,
      equipmentType,
      scopeOfWork,
      documentText,
    });

    let items: any[] = [];
    try {
      const systemPrompt = 'Mechanical engineer. Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation text. Start your response with [ and end with ].';
      
      const aiResponse = await callVisionAI({
        orgId,
        workpackId,
        userPrompt: prompt,
        systemPrompt,
        context: {
          title: workpack.title,
          equipment_type: workpack.equipment_type,
          asset_tag: equipmentTag
        }
      });
      
      items = parseVisionJson(aiResponse);
    } catch (err) {
      console.error('[ToolsGen] AI error:', err);
      return NextResponse.json(
        { error: 'AI extraction service is temporarily unavailable. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[ToolsGen] Parsed tools count:', items.length);
    console.log('[ToolsGen] First tool:', JSON.stringify(items[0]));

    const tools = items
      .filter((t): t is Record<string, unknown> => t != null && typeof t === 'object')
      .map((t) => {
        const q = t.quantity;
        const quantity =
          q == null || q === '' ? null : typeof q === 'number' ? q : parseInt(String(q), 10) || null;
        const toolType = ['Owned', 'Hired', 'Special', 'Standard', 'Consumable'].includes(String(t.toolType))
          ? (t.toolType === 'Owned' ? 'Standard' : t.toolType)
          : 'Standard';
        return {
          category: VALID_CATEGORIES.includes(String(t.category)) ? t.category : 'General',
          name: typeof t.name === 'string' ? t.name : String(t.name ?? ''),
          description: t.description != null ? String(t.description) : null,
          quantity,
          unit: typeof t.unit === 'string' ? t.unit : 'EA',
          toolType,
          certRequired: Boolean(t.certRequired),
          notes: t.notes != null ? String(t.notes) : null,
        };
      });

    const autoSave = body.autoSave === true;
    if (autoSave && tools.length > 0) {
      let created = 0;
      for (const t of tools) {
        if (!t.name?.trim()) continue;
        const category = VALID_CATEGORIES.includes(String(t.category)) ? String(t.category) : 'General';
        const dbCategory: DbCategory = DB_CATEGORIES.includes(category as DbCategory) ? (category as DbCategory) : 'General';
        await prisma.workpack_tools.create({
          data: {
            workpack: { connect: { id: workpackId } },
            organization: { connect: { id: orgId } },
            category: dbCategory,
            name: t.name,
            description: t.description ?? null,
            quantity: t.quantity != null ? t.quantity : null,
            unit: t.unit ?? 'EA',
            tool_type: t.toolType as string,
            source: 'ai',
            cert_required: t.certRequired,
            notes: t.notes ?? null,
            ai_generated: true,
          },
        });
        created++;
      }
      console.log('[ToolsGen] Saved', created, 'tools successfully');
      return NextResponse.json({ saved: true, count: created, created });
    }

    return NextResponse.json({ tools });
  } catch (err) {
    console.error('[TOOLS GENERATE] FATAL ERROR:', err);
    console.error('[TOOLS GENERATE] Stack:', err instanceof Error ? err.stack : err);
    return NextResponse.json(
      { error: 'AI extraction service is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
