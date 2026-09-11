import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { assetId } = await params;
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const nozzles = await prisma.nozzles.findMany({
    where: { asset_id: assetId, deleted_at: null },
    orderBy: [{ sequence_number: 'asc' }, { designation: 'asc' }],
    include: { joint_master: { select: { id: true, joint_number: true } } },
  });
  return NextResponse.json({ data: nozzles });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { assetId } = await params;
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body?.designation?.trim()) return NextResponse.json({ error: 'designation is required' }, { status: 400 });
  const nozzle = await prisma.nozzles.create({
    data: {
      organization_id: orgId,
      asset_id: assetId,
      designation: String(body.designation).trim(),
      service: body.service?.trim() ?? null,
      nominal_size_inches: body.nominal_size_inches != null ? Number(body.nominal_size_inches) : null,
      pressure_rating: body.pressure_rating?.trim() ?? null,
      flange_face: body.flange_face?.trim() ?? null,
      flange_standard: body.flange_standard?.trim() ?? null,
      gasket_type: body.gasket_type?.trim() ?? null,
      gasket_material: body.gasket_material?.trim() ?? null,
      bolt_spec: body.bolt_spec?.trim() ?? null,
      bolt_count: body.bolt_count != null ? Number(body.bolt_count) : null,
      default_torque_nm: body.default_torque_nm != null ? Number(body.default_torque_nm) : null,
      sequence_number: body.sequence_number != null ? Number(body.sequence_number) : 0,
    },
  });
  return NextResponse.json({ data: nozzle }, { status: 201 });
}
