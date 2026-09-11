import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const createBlindSchema = z.object({
  blind_id: z.string().min(1),
  tag: z.string().min(1),
  line_number: z.string().min(1),
  spec: z.string().min(1),
  size: z.string().min(1),
  material: z.string().min(1),
  status: z.enum(['Pending', 'Inserted', 'Removed']).optional(),
  responsible_user_id: z.string().uuid().optional(),
  workpack_id: z.string().uuid().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { session, error } = await guardApi('system:view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  const blinds = await prisma.system_blinds.findMany({
    where: {
      system_id: systemId,
      ...(status && { status }),
    },
    include: {
      responsible_user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ blind_id: 'asc' }],
  });
  return NextResponse.json({ data: blinds });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
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
  const parsed = createBlindSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const blind = await prisma.system_blinds.create({
    data: {
      system_id: systemId,
      blind_id: data.blind_id.trim(),
      tag: data.tag.trim(),
      line_number: data.line_number.trim(),
      spec: data.spec.trim(),
      size: data.size.trim(),
      material: data.material.trim(),
      status: data.status ?? 'Pending',
      responsible_user_id: data.responsible_user_id ?? null,
      workpack_id: data.workpack_id ?? null,
    },
    include: {
      responsible_user: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ data: blind }, { status: 201 });
}
