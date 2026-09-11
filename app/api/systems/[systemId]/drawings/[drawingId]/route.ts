import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const updateDrawingSchema = z.object({
  drawing_no: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  status: z.enum(['For Review', 'Approved', 'Superseded']).optional(),
  file_url: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; drawingId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId, drawingId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const drawing = await prisma.system_drawings.findFirst({
    where: { id: drawingId, system_id: systemId },
    select: { id: true },
  });
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateDrawingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (data.drawing_no !== undefined) updateData.drawing_no = data.drawing_no;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.revision !== undefined) updateData.revision = data.revision;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.file_url !== undefined) updateData.file_url = data.file_url;
  if (data.date !== undefined) updateData.date = data.date ? new Date(data.date as string) : null;

  const updated = await prisma.system_drawings.update({
    where: { id: drawingId },
    data: updateData as any,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; drawingId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId, drawingId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const drawing = await prisma.system_drawings.findFirst({
    where: { id: drawingId, system_id: systemId },
    select: { id: true },
  });
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 });

  await prisma.system_drawings.delete({ where: { id: drawingId } });
  return NextResponse.json({ ok: true });
}
