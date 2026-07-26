import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const updateGasketSchema = z.object({
  gasket_id: z.string().min(1).optional(),
  joint_ref: z.string().min(1).optional(),
  line_number: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  pressure_rating: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  material: z.string().min(1).optional(),
  quantity: z.number().int().min(0).optional(),
  status: z.enum(['Required', 'In Stock', 'Installed']).optional(),
  workpack_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; gasketId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId, gasketId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const gasket = await prisma.systemGasket.findFirst({
    where: { id: gasketId, system_id: systemId },
    select: { id: true },
  });
  if (!gasket) return NextResponse.json({ error: 'Gasket not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateGasketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (data.gasket_id !== undefined) updateData.gasket_id = data.gasket_id;
  if (data.joint_ref !== undefined) updateData.joint_ref = data.joint_ref;
  if (data.line_number !== undefined) updateData.line_number = data.line_number;
  if (data.size !== undefined) updateData.size = data.size;
  if (data.pressure_rating !== undefined) updateData.pressure_rating = data.pressure_rating;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.material !== undefined) updateData.material = data.material;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.workpack_id !== undefined) updateData.workpack_id = data.workpack_id;

  const updated = await prisma.systemGasket.update({
    where: { id: gasketId },
    data: updateData as any,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; gasketId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId, gasketId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const gasket = await prisma.systemGasket.findFirst({
    where: { id: gasketId, system_id: systemId },
    select: { id: true },
  });
  if (!gasket) return NextResponse.json({ error: 'Gasket not found' }, { status: 404 });

  await prisma.systemGasket.delete({ where: { id: gasketId } });
  return NextResponse.json({ ok: true });
}
