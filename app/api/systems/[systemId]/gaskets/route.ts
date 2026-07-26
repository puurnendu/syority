import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const createGasketSchema = z.object({
  gasket_id: z.string().min(1),
  joint_ref: z.string().min(1),
  line_number: z.string().min(1),
  size: z.string().min(1),
  pressure_rating: z.string().min(1),
  type: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().int().min(0).optional(),
  status: z.enum(['Required', 'In Stock', 'Installed']).optional(),
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
  const gaskets = await prisma.systemGasket.findMany({
    where: {
      system_id: systemId,
      ...(status && { status }),
    },
    orderBy: [{ gasket_id: 'asc' }],
  });
  return NextResponse.json({ data: gaskets });
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
  const parsed = createGasketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const gasket = await prisma.systemGasket.create({
    data: {
      system_id: systemId,
      gasket_id: data.gasket_id.trim(),
      joint_ref: data.joint_ref.trim(),
      line_number: data.line_number.trim(),
      size: data.size.trim(),
      pressure_rating: data.pressure_rating.trim(),
      type: data.type.trim(),
      material: data.material.trim(),
      quantity: data.quantity ?? 1,
      status: data.status ?? 'Required',
      workpack_id: data.workpack_id ?? null,
    },
  });
  return NextResponse.json({ data: gasket }, { status: 201 });
}
