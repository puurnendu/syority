import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const createDrawingSchema = z.object({
  drawing_no: z.string().min(1),
  title: z.string().min(1),
  revision: z.string().min(1),
  type: z.string().min(1),
  status: z.enum(['For Review', 'Approved', 'Superseded']).optional(),
  file_url: z.string().optional(),
  date: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
  const drawings = await prisma.systemDrawing.findMany({
    where: { system_id: systemId },
    orderBy: [{ drawing_no: 'asc' }],
  });
  return NextResponse.json({ data: drawings });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = createDrawingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const drawing = await prisma.systemDrawing.create({
    data: {
      system_id: systemId,
      drawing_no: data.drawing_no.trim(),
      title: data.title.trim(),
      revision: data.revision.trim(),
      type: data.type.trim(),
      status: data.status ?? 'For Review',
      file_url: data.file_url?.trim() ?? null,
      date: data.date ? new Date(data.date) : null,
    },
  });
  return NextResponse.json({ data: drawing }, { status: 201 });
}
