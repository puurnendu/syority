import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

type MaterialInput = {
  category?: string | null;
  itemCode?: string | null;
  description: string;
  quantity?: number;
  unit?: string;
  spec?: string | null;
  linkedJointNo?: string | null;
  source?: string;
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
    select: { id: true, site_id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const materials = Array.isArray(body?.materials) ? body.materials as MaterialInput[] : [];
  const skipDuplicates = Boolean(body?.skipDuplicates);

  if (materials.length === 0) {
    return NextResponse.json({ error: 'materials array is required and must not be empty' }, { status: 400 });
  }

  const created: string[] = [];
  const skipped = skipDuplicates ? new Set<string>() : null;

  for (const m of materials) {
    const description = (m.description ?? '').toString().trim();
    if (!description) continue;

    if (skipDuplicates) {
      const key = `${description.toLowerCase()}-${(m.quantity ?? 1)}-${m.unit ?? 'EA'}`;
      if (skipped!.has(key)) continue;
      skipped!.add(key);
    }

    const line = await prisma.workpack_material_lines.create({
      data: {
        id: crypto.randomUUID(),
        organization_id: orgId,
        workpack_id: workpackId,
        source_type: 'ai',
        source_id: null,
        category: (m.category ?? '').toString().trim() || null,
        linked_to: (m.linkedJointNo ?? '').toString().trim() || null,
        item_code: (m.itemCode ?? '').toString().trim() || null,
        description,
        specification: (m.spec ?? '').toString().trim() || null,
        unit_of_measure: (m.unit ?? 'EA').toString().trim() || 'EA',
        quantity_required: typeof m.quantity === 'number' ? m.quantity : parseFloat(String(m.quantity)) || 1,
        procurement_status: 'not_requested',
        notes: (m.notes ?? '').toString().trim() || null,
        updated_at: new Date(),
      },
    });
    created.push(line.id);
  }

  return NextResponse.json({ created: created.length, ids: created }, { status: 201 });
}
