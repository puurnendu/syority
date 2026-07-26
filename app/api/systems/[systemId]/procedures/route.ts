import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const createProcedureSchema = z.object({
  procedure_no: z.string().min(1),
  title: z.string().min(1),
  type: z.string().min(1),
  revision: z.string().min(1),
  status: z.enum(['Draft', 'Approved', 'Superseded']).optional(),
  owner: z.string().optional(),
  file_url: z.string().optional(),
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
  const procedures = await prisma.systemProcedure.findMany({
    where: { system_id: systemId },
    orderBy: [{ procedure_no: 'asc' }],
  });
  return NextResponse.json({ data: procedures });
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
  const parsed = createProcedureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const procedure = await prisma.systemProcedure.create({
    data: {
      system_id: systemId,
      procedure_no: data.procedure_no.trim(),
      title: data.title.trim(),
      type: data.type.trim(),
      revision: data.revision.trim(),
      status: data.status ?? 'Draft',
      owner: data.owner?.trim() ?? null,
      file_url: data.file_url?.trim() ?? null,
    },
  });
  return NextResponse.json({ data: procedure }, { status: 201 });
}
