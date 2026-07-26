import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id: workpackId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tools = await prisma.workpackTool.findMany({
    where: { workpack_id: workpackId, organization_id: orgId },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const summary = {
    total: tools.length,
    special: tools.filter((t) => t.tool_type === 'Special').length,
    hired: tools.filter((t) => t.tool_type === 'Hired').length,
  };

  return NextResponse.json({ tools, summary });
}

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
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const category = (body.category ?? 'General').toString();
  const validCategories = [
    'Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Hydraulic',
    'Measurement', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General',
  ];
  const categoryEnum = validCategories.includes(category) ? category : 'General';

  const tool = await prisma.workpackTool.create({
    data: {
      organization_id: orgId,
      workpack_id: workpackId,
      category: categoryEnum as any,
      name: String(body.name).trim(),
      description: body.description?.trim() || null,
      quantity: typeof body.quantity === 'number' ? body.quantity : parseInt(String(body.quantity), 10) || 1,
      unit: body.unit?.trim() || 'EA',
      tool_type: ['Standard', 'Special', 'Hired', 'Consumable'].includes(body.tool_type) ? body.tool_type : 'Standard',
      source: 'manual',
      cert_required: Boolean(body.cert_required),
      notes: body.notes?.trim() || null,
      status: body.status?.trim() || 'Required',
    },
  });

  return NextResponse.json(tool, { status: 201 });
}
