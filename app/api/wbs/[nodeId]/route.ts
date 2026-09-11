import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { WbsNodeType } from '@prisma/client';

const updateNodeSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  type: z.nativeEnum(WbsNodeType).optional(),
  order: z.number().int().min(0).optional(),
  parent_id: z.string().uuid().optional().nullable(),
  linked_entity_id: z.string().uuid().optional().nullable(),
  linked_entity_type: z.string().optional().nullable(),
  locked: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  const { session, error } = await guardApi('system:wbs:manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { nodeId } = await params;

  const node = await prisma.wbsNode.findFirst({
    where: { id: nodeId, organization_id: orgId },
    select: { id: true, locked: true, parent_id: true, event_id: true, project_id: true },
  });
  if (!node) return NextResponse.json({ error: 'WBS node not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data as Record<string, unknown>;

  if (data.parent_id !== undefined && data.parent_id !== null) {
    const parent = await prisma.wbsNode.findFirst({
      where: {
        id: data.parent_id as string,
        organization_id: orgId,
        ...(node.event_id ? { event_id: node.event_id } : { project_id: node.project_id }),
      },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: 'Parent node not found' }, { status: 404 });
    if (data.parent_id === nodeId) return NextResponse.json({ error: 'Cannot set parent to self' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (data.code !== undefined) updateData.code = data.code;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
  if (data.linked_entity_id !== undefined) updateData.linked_entity_id = data.linked_entity_id;
  if (data.linked_entity_type !== undefined) updateData.linked_entity_type = data.linked_entity_type;
  if (data.locked !== undefined) updateData.locked = data.locked;

  const updated = await prisma.wbsNode.update({
    where: { id: nodeId },
    data: updateData as any,
    include: { parent: { select: { id: true, code: true, name: true } } },
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  const { session, error } = await guardApi('system:wbs:manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { nodeId } = await params;

  const node = await prisma.wbsNode.findFirst({
    where: { id: nodeId, organization_id: orgId },
    select: { id: true, locked: true },
  });
  if (!node) return NextResponse.json({ error: 'WBS node not found' }, { status: 404 });
  if (node.locked) return NextResponse.json({ error: 'Cannot delete locked node' }, { status: 403 });

  async function deleteRecursive(id: string) {
    const children = await prisma.wbsNode.findMany({ where: { parent_id: id }, select: { id: true, locked: true } });
    for (const c of children) {
      if (c.locked) throw new Error('Cannot delete: a child node is locked');
      await deleteRecursive(c.id);
    }
    await prisma.wbsNode.delete({ where: { id } });
  }
  await deleteRecursive(nodeId);
  return NextResponse.json({ ok: true });
}
