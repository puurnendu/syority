import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { WbsNodeType } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:wbs:generate');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;

  const body = await req.json().catch(() => ({}));
  const eventId = body.event_id as string | undefined;
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 });

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    include: { unit: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true, code: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const existing = await prisma.wbsNode.findFirst({
    where: { system_id: systemId, event_id: eventId },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'WBS already exists for this system/event' }, { status: 409 });

  const assets = await prisma.asset.findMany({
    where: { system_id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true, tag_number: true, name: true },
    orderBy: { tag_number: 'asc' },
  });
  const workpacks = await prisma.workpack.findMany({
    where: { system_id: systemId, organization_id: orgId, event_id: eventId, deleted_at: null },
    select: { id: true, title: true, workpack_id_code: true, asset_id: true },
    orderBy: { workpack_id_code: 'asc' },
  });

  const unitCode = system.unit?.code ?? 'U';
  const sysCode = system.code ?? system.id.slice(0, 8);
  const baseCode = `${event.code}.${unitCode}.${sysCode}`;
  let order = 0;

  const systemNode = await prisma.wbsNode.create({
    data: {
      organization_id: orgId,
      event_id: eventId,
      system_id: systemId,
      parent_id: null,
      code: baseCode,
      name: system.name,
      type: WbsNodeType.SYSTEM,
      order: order++,
    },
  });

  const hoNode = await prisma.wbsNode.create({
    data: {
      organization_id: orgId,
      event_id: eventId,
      system_id: systemId,
      parent_id: systemNode.id,
      code: `${baseCode}.HO`,
      name: 'Handover',
      type: WbsNodeType.HO_WBS,
      order: order++,
    },
  });

  for (const asset of assets) {
    const equipNode = await prisma.wbsNode.create({
      data: {
        organization_id: orgId,
        event_id: eventId,
        system_id: systemId,
        parent_id: hoNode.id,
        code: `${baseCode}.${asset.tag_number}`,
        name: asset.name,
        type: WbsNodeType.EQUIPMENT,
        order: order++,
        linked_entity_id: asset.id,
        linked_entity_type: 'equipment',
      },
    });
    const wpsForAsset = workpacks.filter((w) => w.asset_id === asset.id);
    const toUse = wpsForAsset.length > 0 ? wpsForAsset : workpacks;
    for (const wp of toUse) {
      const wpCode = wp.workpack_id_code ?? wp.id.slice(0, 8);
      await prisma.wbsNode.create({
        data: {
          organization_id: orgId,
          event_id: eventId,
          system_id: systemId,
          parent_id: equipNode.id,
          code: `${baseCode}.${asset.tag_number}.${wpCode}`,
          name: wp.title,
          type: WbsNodeType.WORKPACK,
          order: order++,
          linked_entity_id: wp.id,
          linked_entity_type: 'workpack',
        },
      });
    }
  }

  await prisma.wbsNode.create({
    data: {
      organization_id: orgId,
      event_id: eventId,
      system_id: systemId,
      parent_id: systemNode.id,
      code: `${baseCode}.TO`,
      name: 'Takeover',
      type: WbsNodeType.TO_WBS,
      order: order++,
    },
  });

  const nodes = await prisma.wbsNode.findMany({
    where: { system_id: systemId, event_id: eventId },
    orderBy: [{ order: 'asc' }],
  });
  return NextResponse.json({ data: nodes }, { status: 201 });
}
