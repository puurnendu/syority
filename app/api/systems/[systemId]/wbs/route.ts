import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { WbsNodeType } from '@prisma/client';

const createNodeSchema = z.object({
  event_id: z.string().uuid(),
  parent_id: z.string().uuid().optional().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(WbsNodeType),
  order: z.number().int().min(0).optional(),
  linked_entity_id: z.string().uuid().optional().nullable(),
  linked_entity_type: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;
  const eventId = req.nextUrl.searchParams.get('event_id') ?? undefined;

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const where: { organization_id: string; system_id: string; event_id?: string } = {
    organization_id: orgId,
    system_id: systemId,
  };
  if (eventId) where.event_id = eventId;

  const nodes = await prisma.wbsNode.findMany({
    where,
    orderBy: [{ order: 'asc' }, { code: 'asc' }],
    include: { parent: { select: { id: true, code: true, name: true } } },
  });

  function toTree(list: typeof nodes, parentId: string | null): typeof nodes {
    return list
      .filter((n) => (n.parent_id ?? null) === parentId)
      .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
      .map((n) => ({ ...n, children: toTree(list, n.id) }));
  }
  const tree = toTree(nodes, null);
  return NextResponse.json({ data: tree, flat: nodes });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:wbs:manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const event = await prisma.event.findFirst({
    where: { id: data.event_id, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  if (data.parent_id) {
    const parent = await prisma.wbsNode.findFirst({
      where: { id: data.parent_id, organization_id: orgId, event_id: data.event_id },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: 'Parent node not found' }, { status: 404 });
  }

  const node = await prisma.wbsNode.create({
    data: {
      organization_id: orgId,
      event_id: data.event_id,
      system_id: systemId,
      parent_id: data.parent_id ?? null,
      code: data.code.trim(),
      name: data.name.trim(),
      type: data.type,
      order: data.order ?? 0,
      linked_entity_id: data.linked_entity_id ?? null,
      linked_entity_type: data.linked_entity_type ?? null,
    },
    include: { parent: { select: { id: true, code: true, name: true } } },
  });
  return NextResponse.json({ data: node }, { status: 201 });
}
