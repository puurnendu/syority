import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string; nozzleId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { assetId, nozzleId } = await params;
  const nozzle = await prisma.nozzles.findFirst({
    where: { id: nozzleId, asset_id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!nozzle) return NextResponse.json({ error: 'Nozzle not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (v != null && typeof v === 'string' ? v.trim() : null);
  const num = (v: unknown) => (v != null && (typeof v === 'number' || !Number.isNaN(Number(v))) ? Number(v) : undefined);
  if (body.designation !== undefined) data.designation = str(body.designation) ?? undefined;
  if (body.service !== undefined) data.service = str(body.service) ?? null;
  if (body.nominal_size_inches !== undefined) data.nominal_size_inches = num(body.nominal_size_inches) ?? null;
  if (body.pressure_rating !== undefined) data.pressure_rating = str(body.pressure_rating) ?? null;
  if (body.flange_face !== undefined) data.flange_face = str(body.flange_face) ?? null;
  if (body.flange_standard !== undefined) data.flange_standard = str(body.flange_standard) ?? null;
  if (body.gasket_type !== undefined) data.gasket_type = str(body.gasket_type) ?? null;
  if (body.gasket_material !== undefined) data.gasket_material = str(body.gasket_material) ?? null;
  if (body.bolt_spec !== undefined) data.bolt_spec = str(body.bolt_spec) ?? null;
  if (body.bolt_count !== undefined) data.bolt_count = num(body.bolt_count) ?? null;
  if (body.default_torque_nm !== undefined) data.default_torque_nm = num(body.default_torque_nm) ?? null;
  if (body.sequence_number !== undefined) data.sequence_number = num(body.sequence_number) ?? null;
  if (body.notes !== undefined) data.notes = str(body.notes) ?? null;

  const updated = await prisma.nozzles.update({
    where: { id: nozzleId },
    data: data as any,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string; nozzleId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { assetId, nozzleId } = await params;
  const nozzle = await prisma.nozzles.findFirst({
    where: { id: nozzleId, asset_id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!nozzle) return NextResponse.json({ error: 'Nozzle not found' }, { status: 404 });

  await prisma.nozzles.update({
    where: { id: nozzleId },
    data: { deleted_at: new Date() },
  });
  return NextResponse.json({ ok: true });
}
