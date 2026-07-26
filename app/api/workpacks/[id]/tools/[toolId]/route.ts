import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const VALID_CATEGORIES = [
  'Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Hydraulic',
  'Measurement', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General',
];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; toolId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId, toolId } = await context.params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = String(body.name).trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.quantity !== undefined) updateData.quantity = parseInt(String(body.quantity), 10) || 1;
  if (body.unit !== undefined) updateData.unit = String(body.unit).trim() || 'EA';
  if (body.tool_type !== undefined) updateData.tool_type = body.tool_type;
  if (body.cert_required !== undefined) updateData.cert_required = Boolean(body.cert_required);
  if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.category !== undefined && VALID_CATEGORIES.includes(body.category)) {
    updateData.category = body.category;
  }

  const tool = await prisma.workpackTool.findFirst({
    where: { id: toolId, workpack_id: workpackId, organization_id: orgId },
  });
  if (!tool) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.workpackTool.update({
    where: { id: toolId },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; toolId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId, toolId } = await context.params;

  const tool = await prisma.workpackTool.findFirst({
    where: { id: toolId, workpack_id: workpackId, organization_id: orgId },
  });
  if (!tool) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.workpackTool.delete({ where: { id: toolId } });
  return NextResponse.json({ success: true });
}
