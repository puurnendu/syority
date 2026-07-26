import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || body.action !== 'setIncluded') {
    return NextResponse.json({ error: 'action "setIncluded" required' }, { status: 400 });
  }

  const value = body.value === true;

  if (body.discipline) {
    const count = await prisma.workpackMaterialLine.updateMany({
      where: {
        workpack_id: id,
        organization_id: orgId,
        deleted_at: null,
        material_category: body.discipline,
      },
      data: { includedInPdf: value },
    });
    return NextResponse.json({ success: true, updated: count.count });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const count = await prisma.workpackMaterialLine.updateMany({
      where: {
        id: { in: body.ids },
        workpack_id: id,
        organization_id: orgId,
        deleted_at: null,
      },
      data: { includedInPdf: value },
    });
    return NextResponse.json({ success: true, updated: count.count });
  }

  return NextResponse.json({ error: 'discipline or ids required' }, { status: 400 });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  if (!body?.ids?.length || !body.updates) {
    return NextResponse.json(
      { error: 'ids and updates are required' },
      { status: 400 }
    );
  }

  const validLines = await prisma.workpackMaterialLine.findMany({
    where: {
      id: { in: body.ids as string[] },
      workpack_id: id,
      organization_id: orgId,
      deleted_at: null,
    },
    select: { id: true },
  });
  const validIds = validLines.map((l) => l.id);

  if (validIds.length === 0) {
    return NextResponse.json({ error: 'No valid materials found' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.updates.procurement_status !== undefined) data.procurement_status = body.updates.procurement_status;
  if (body.updates.includedInPdf !== undefined) data.includedInPdf = body.updates.includedInPdf;

  await prisma.workpackMaterialLine.updateMany({
    where: { id: { in: validIds } },
    data,
  });

  return NextResponse.json({ updated: validIds.length });
}
