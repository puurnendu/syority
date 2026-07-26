import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import path from 'path';
import { existsSync } from 'fs';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const POST = withTenantGuard(async (req, { params }, session) => {
  const { id } = await params;
  const user = session.user;
  const orgId = user.organization_id;

  const workpack = await prisma.workpack.findUnique({
    where: { id, organization_id: orgId },
    include: {
      asset: true,
      activities: {
        where: { deleted_at: null },
        orderBy: { sequence_number: 'asc' },
        take: 20,
      },
      documents: {
        where: { deleted_at: null }
      }
    },
  });

  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
  const techData = workpack.equipment_technical_data as Record<string, any> | null;
  const wp = workpack as { scope?: string; description?: string; asset?: { tag?: string; name?: string } | null; activities: { description: string; sequence_number?: number | null }[] };

  const getConfirmedValue = (obj: any, key: string): string => {
    if (!obj) return 'As per drawing';
    const field = obj[key];
    if (field && typeof field === 'object' && 'value' in field) return String(field.value ?? 'As per drawing');
    return String(obj[key] ?? 'As per drawing');
  };

  const equipmentTag = wp.asset?.tag ?? 'Equipment';
  const equipmentDesc = wp.asset?.name ?? workpack.title;
  const shellTestPr = getConfirmedValue(techData?.hydrotest, 'shellSideTestPressure');
  const tubeTestPr = getConfirmedValue(techData?.hydrotest, 'tubeSideTestPressure');
  const activities = wp.activities.map((a) => a.description).filter(Boolean);

  const prompt = `You are a senior refinery maintenance engineer writing a Method Statement for a shutdown workpack.

Equipment: ${equipmentTag} — ${equipmentDesc}
Workpack Scope: ${wp.scope ?? wp.description ?? workpack.scope_of_work ?? 'General maintenance'}
Activities: ${activities.join(', ')}
Shell Side Test Pressure: ${shellTestPr}
Tube Side Test Pressure: ${tubeTestPr}

Document Context:
${documentText}

Generate a professional Method Statement in JSON format with this exact structure:
{
  "title": "Method Statement — ${equipmentTag}",
  "revision": "Rev 0",
  "equipmentTag": "${equipmentTag}",
  "equipmentDescription": "${equipmentDesc}",
  "scope": "2-3 sentence summary of work scope",
  "resources": {
    "manpower": [
      { "role": "Maintenance Supervisor", "quantity": 1 },
      { "role": "Fitter", "quantity": 4 }
    ],
    "equipment": [
      { "item": "Mobile Crane 25T", "quantity": 1 }
    ],
    "materials": [
      { "item": "Gaskets (as per nozzle schedule)", "quantity": "As required" }
    ]
  },
  "preSdSteps": [
    { "step": 1, "description": "...", "responsible": "Contractor", "safetyNote": "..." }
  ],
  "shutdownSteps": [
    { "step": 1, "description": "...", "responsible": "Contractor", "safetyNote": "..." }
  ],
  "postSdSteps": [
    { "step": 1, "description": "...", "responsible": "Contractor", "safetyNote": "..." }
  ],
  "testProcedure": {
    "shellSideSteps": ["Fill with water", "Apply pressure ${shellTestPr}", "Hold 30 minutes", "Check for leaks"],
    "tubeSideSteps":  ["Fill with water", "Apply pressure ${tubeTestPr}", "Hold 30 minutes", "Check for leaks"]
  },
  "references": ["Equipment Drawing", "P&ID", "Applicable ASME/IBR standard"]
}

Generate realistic steps based on the equipment type and activities. Include safety notes for hazardous steps.`;

  try {
    const aiResponse = await callVisionAI({
      orgId,
      workpackId: id,
      userPrompt: prompt,
      context: {
        title: workpack.title,
        equipment_tag: equipmentTag,
        asset_name: equipmentDesc
      }
    });

    const results = parseVisionJson(aiResponse);

    const content = Array.isArray(results) ? results[0] : results;

    // Save as a workpack attachment
    const attachment = await prisma.workpackAttachment.upsert({
      where: {
        id: `ms-${id}`,
      },
      create: {
        id: `ms-${id}`,
        workpackId: id,
        group: 'procedures',
        subGroup: 'method_statement',
        sortOrder: 0,
        title: `Method Statement — ${equipmentTag}`,
        attachmentType: 'generated',
        templateKey: 'method_statement',
        content,
        isActive: true,
      },
      update: {
        content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ attachment, content });
  } catch (err: any) {
    console.error('Method Statement Error:', err);
    return NextResponse.json(
      { error: 'AI extraction service is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
});
