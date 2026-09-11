import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const updateSystemSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  criticality: z.enum(['High', 'Medium', 'Low']).optional(),
  status: z.string().optional(),
  p_and_id_ref: z.string().optional(),
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
    include: {
      site: { select: { id: true, name: true, code: true } },
      unit: { select: { id: true, name: true, code: true } },
      _count: {
        select: { system_blinds: true, system_gaskets: true, system_drawings: true, system_procedures: true, workpacks: true, line_lists: true, assets: true },
      },
    },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });
  return NextResponse.json({ data: system });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId } = await params;
  const existing = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSystemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data as Record<string, unknown>;

  const system = await prisma.system.update({
    where: { id: systemId },
    data: {
      ...(data.code !== undefined && { code: data.code as string }),
      ...(data.name !== undefined && { name: data.name as string }),
      ...(data.description !== undefined && { description: (data.description as string) ?? null }),
      ...(data.criticality !== undefined && { criticality: (data.criticality as string) ?? null }),
      ...(data.status !== undefined && { status: data.status as string }),
      ...(data.p_and_id_ref !== undefined && { p_and_id_ref: (data.p_and_id_ref as string) ?? null }),
    },
    include: {
      site: { select: { id: true, name: true, code: true } },
      unit: { select: { id: true, name: true, code: true } },
      _count: { select: { system_blinds: true, system_gaskets: true, workpacks: true } },
    },
  });
  return NextResponse.json({ data: system });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string }> }
) {
  const { session, error } = await guardApi('system:delete');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId } = await params;
  const existing = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  await prisma.system.update({
    where: { id: systemId },
    data: { deleted_at: new Date() },
  });
  return NextResponse.json({ ok: true });
}
