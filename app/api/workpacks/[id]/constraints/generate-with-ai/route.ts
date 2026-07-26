import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import path from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

function buildConstraintPrompt(params: {
  equipmentTag: string;
  equipmentType: string;
  scopeDescription: string;
  activitiesSummary: string;
  documentText: string;
}) {
  const { equipmentTag, equipmentType, scopeDescription, activitiesSummary, documentText } = params;
  return `You are a turnaround planning engineer.

Generate a list of typical pre-job constraints (open items that must be resolved before or during the job) for this workpack:

Equipment: ${equipmentTag} — ${equipmentType}
Scope: ${scopeDescription || '(no scope)'}
Activities: ${activitiesSummary || '(no activities)'}

ENGINEERING DOCUMENTS:
${documentText}

Generate constraints in these categories:

1. PERMITS & ISOLATION — PTW, P&ID isolation, electrical isolation, confined space permit
2. MATERIALS & PROCUREMENT — gaskets on site, replacement parts procured, bolts verified
3. DOCUMENTATION — QAP approved, rigging study approved, WPS/PQR available
4. INSPECTION & HOLD POINTS — pre-job meeting, bundle inspection hold, NDT accepted
5. UTILITIES & SERVICES — scaffolding erected, temporary lighting, water for hydrotest
6. SAFETY — SIMOPS check, tool box talk, confined space rescue plan

Return ONLY a valid JSON array, no other text or markdown:
[
  {
    "category": "technical",
    "title": "Permit to Work (PTW) issuance",
    "description": "Cold work PTW must be issued and displayed before any activity commences.",
    "severity": "critical"
  }
]

Use severity: critical | high | medium | low. Generate 8–18 items. Use document content (hold points, test pressures, codes) where relevant.

IMPORTANT: Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation text. Start your response with [ and end with ].`;
}

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

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
  const autoSave = body.autoSave === true;

  const equipmentTag = (workpack.title ?? '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) || 'WP';
  const equipmentType = (workpack.equipment_type ?? 'Equipment').toString();
  const scopeDescription = (workpack.scope_of_work ?? '').toString().slice(0, 500);
  const activitiesSummary = workpack.activities
    .map((a) => `${a.work_category ?? ''}: ${(a.description ?? '').slice(0, 80)}`)
    .join('; ');

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

  const prompt = buildConstraintPrompt({
    equipmentTag,
    equipmentType,
    scopeDescription,
    activitiesSummary,
    documentText,
  });

  let items: any[] = [];
  try {
    const systemPrompt = 'You are a shutdown planning engineer. Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation text. Start your response with [ and end with ].';
    
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
    console.error('[ConstraintsGen] AI error:', err);
    return NextResponse.json(
      { error: 'AI extraction service is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }

  const constraints = items
    .filter((c): c is Record<string, unknown> => c != null && typeof c === 'object')
    .map((c) => ({
      category: typeof c.category === 'string' ? c.category : 'technical',
      title: typeof c.title === 'string' ? c.title : String(c.title ?? '').trim(),
      description: typeof c.description === 'string' ? c.description : String(c.description ?? ''),
      severity: SEVERITIES.includes(String(c.severity) as (typeof SEVERITIES)[number]) ? c.severity : 'medium',
    }))
    .filter((c) => c.title.length > 0);

  const regenerate = body.regenerate === true;
  const preserveManual = body.preserveManual !== false;
  if (autoSave && constraints.length > 0) {
    if (regenerate && preserveManual) {
      await prisma.constraintLog.deleteMany({
        where: { workpack_id: workpackId, organization_id: orgId, ai_generated: true, deleted_at: null },
      });
    }
    const existingCount = await prisma.constraintLog.count({
      where: { workpack_id: workpackId, deleted_at: null },
    });
    const wpRef = (workpack as any).workpack_id_code ?? workpackId.slice(0, 8);
    let seq = existingCount;
    let created = 0;
    for (const c of constraints) {
      seq++;
      const conNum = `CON-${wpRef}-${String(seq).padStart(3, '0')}`;
      const severity = SEVERITIES.includes(c.severity as (typeof SEVERITIES)[number]) ? c.severity : 'medium';
      await prisma.constraintLog.create({
        data: {
          organization_id: orgId,
          workpack_id: workpackId,
          constraint_number: conNum,
          title: c.title,
          description: c.description.slice(0, 5000),
          category: 'technical',
          severity: severity as string,
          status: 'open',
          ai_generated: true,
          is_in_central_register: true,
        },
      });
      created++;
    }
    return NextResponse.json({ saved: true, count: created, created });
  }

  return NextResponse.json({ constraints });
  } catch (err) {
    console.error('[CONSTRAINTS GENERATE] FATAL ERROR:', err);
    console.error('[CONSTRAINTS GENERATE] Stack:', err instanceof Error ? err.stack : err);
    return NextResponse.json(
      { error: 'AI extraction service is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
