import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const updateBlindSchema = z.object({
  blind_id: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  line_number: z.string().min(1).optional(),
  spec: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  material: z.string().min(1).optional(),
  status: z.enum(['Pending', 'Inserted', 'Removed']).optional(),
  inserted_at: z.string().optional().nullable(),
  removed_at: z.string().optional().nullable(),
  responsible_user_id: z.string().uuid().optional().nullable(),
  workpack_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ systemId: string; blindId: string }> }) {
  const { session, error } = await guardApi('system:blind:update');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId, blindId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
  const blind = await prisma.system_blinds.findFirst({
    where: { id: blindId, system_id: systemId },
    select: { id: true },
  });
  if (!blind) return NextResponse.json({ error: 'Blind not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = updateBlindSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (data.blind_id !== undefined) updateData.blind_id = data.blind_id;
  if (data.tag !== undefined) updateData.tag = data.tag;
  if (data.line_number !== undefined) updateData.line_number = data.line_number;
  if (data.spec !== undefined) updateData.spec = data.spec;
  if (data.size !== undefined) updateData.size = data.size;
  if (data.material !== undefined) updateData.material = data.material;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.inserted_at !== undefined) updateData.inserted_at = data.inserted_at ? new Date(data.inserted_at as string) : null;
  if (data.removed_at !== undefined) updateData.removed_at = data.removed_at ? new Date(data.removed_at as string) : null;
  if (data.responsible_user_id !== undefined) updateData.responsible_user_id = data.responsible_user_id;
  if (data.workpack_id !== undefined) updateData.workpack_id = data.workpack_id;
  const updated = await prisma.system_blinds.update({
    where: { id: blindId },
    data: updateData as any,
    include: { responsible_user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ systemId: string; blindId: string }> }) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId, blindId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
  const blind = await prisma.system_blinds.findFirst({
    where: { id: blindId, system_id: systemId },
    select: { id: true },
  });
  if (!blind) return NextResponse.json({ error: 'Blind not found' }, { status: 404 });
  await prisma.system_blinds.delete({ where: { id: blindId } });
  return NextResponse.json({ ok: true });
}
