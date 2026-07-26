import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const updateProcedureSchema = z.object({
  procedure_no: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
  status: z.enum(['Draft', 'Approved', 'Superseded']).optional(),
  owner: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; procedureId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId, procedureId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const procedure = await prisma.systemProcedure.findFirst({
    where: { id: procedureId, system_id: systemId },
    select: { id: true },
  });
  if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateProcedureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (data.procedure_no !== undefined) updateData.procedure_no = data.procedure_no;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.revision !== undefined) updateData.revision = data.revision;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.owner !== undefined) updateData.owner = data.owner;
  if (data.file_url !== undefined) updateData.file_url = data.file_url;

  const updated = await prisma.systemProcedure.update({
    where: { id: procedureId },
    data: updateData as any,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; procedureId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { systemId, procedureId } = await params;
  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const procedure = await prisma.systemProcedure.findFirst({
    where: { id: procedureId, system_id: systemId },
    select: { id: true },
  });
  if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

  await prisma.systemProcedure.delete({ where: { id: procedureId } });
  return NextResponse.json({ ok: true });
}
