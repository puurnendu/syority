import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = [
  'Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Hydraulic',
  'Measurement', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General',
];

type ToolInput = {
  category: string;
  name: string;
  description?: string | null;
  quantity?: number;
  unit?: string;
  toolType?: string;
  certRequired?: boolean;
  notes?: string | null;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id: workpackId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const tools = Array.isArray(body?.tools) ? (body.tools as ToolInput[]) : [];

  if (tools.length === 0) {
    return NextResponse.json({ error: 'tools array is required and must not be empty' }, { status: 400 });
  }

  const created: string[] = [];

  for (const t of tools) {
    const name = (t.name ?? '').toString().trim();
    if (!name) continue;

    const category = VALID_CATEGORIES.includes(t.category) ? t.category : 'General';
    const toolType = ['Standard', 'Special', 'Hired', 'Consumable'].includes(t.toolType ?? '') ? t.toolType : 'Standard';

    const tool = await prisma.workpackTool.create({
      data: {
        organization_id: orgId,
        workpack_id: workpackId,
        category: category as any,
        name,
        description: (t.description ?? '').toString().trim() || null,
        quantity: typeof t.quantity === 'number' ? t.quantity : parseInt(String(t.quantity), 10) || 1,
        unit: (t.unit ?? 'EA').toString().trim() || 'EA',
        tool_type: toolType,
        source: 'ai',
        cert_required: Boolean(t.certRequired),
        notes: (t.notes ?? '').toString().trim() || null,
        status: 'Required',
        ai_generated: true,
      },
    });
    created.push(tool.id);
  }

  return NextResponse.json({ created: created.length, ids: created }, { status: 201 });
}
