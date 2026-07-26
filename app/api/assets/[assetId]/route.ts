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
    include: {
      site: { select: { id: true, name: true, code: true } },
      system: { select: { id: true, name: true, code: true }, include: { unit: { select: { id: true, name: true, code: true }, include: { plant: { select: { id: true, name: true, code: true } } } } } },
      nozzles: { where: { deleted_at: null }, orderBy: { sequence_number: 'asc' } },
      line_connections: { include: { line: { select: { id: true, line_number: true, total_joint_count: true } } } },
      _count: { select: { joint_masters: true } },
    },
  });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const workpackHistory = await prisma.workpack.findMany({
    where: { asset_id: assetId, deleted_at: null },
    select: { id: true, title: true, workpack_id_code: true, status: true, updated_at: true },
    orderBy: { updated_at: 'desc' },
    take: 5,
  });
  return NextResponse.json({ data: { ...asset, workpack_history: workpackHistory, joint_count: asset._count.joint_masters } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { assetId } = await params;
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (v != null && typeof v === 'string' ? v.trim() : null);
  const num = (v: unknown) => (v != null && (typeof v === 'number' || !Number.isNaN(Number(v))) ? Number(v) : undefined);
  if (body.name !== undefined) data.name = str(body.name) ?? undefined;
  if (body.asset_type !== undefined) data.asset_type = str(body.asset_type) ?? null;
  if (body.system_id !== undefined) data.system_id = body.system_id ?? null;
  if (body.sap_equipment_number !== undefined) data.sap_equipment_number = str(body.sap_equipment_number) ?? null;
  if (body.description !== undefined) data.description = str(body.description) ?? null;
  if (body.manufacturer !== undefined) data.manufacturer = str(body.manufacturer) ?? null;
  if (body.model_number !== undefined) data.model_number = str(body.model_number) ?? null;
  if (body.serial_number !== undefined) data.serial_number = str(body.serial_number) ?? null;
  if (body.year_installed !== undefined) data.year_installed = num(body.year_installed) ?? null;
  if (body.design_pressure_barg !== undefined) data.design_pressure_barg = num(body.design_pressure_barg) ?? null;
  if (body.design_temp_c !== undefined) data.design_temp_c = num(body.design_temp_c) ?? null;
  if (body.operating_pressure_barg !== undefined) data.operating_pressure_barg = num(body.operating_pressure_barg) ?? null;
  if (body.operating_temp_c !== undefined) data.operating_temp_c = num(body.operating_temp_c) ?? null;
  if (body.test_pressure_barg !== undefined) data.test_pressure_barg = num(body.test_pressure_barg) ?? null;
  if (body.weight_empty_kg !== undefined) data.weight_empty_kg = num(body.weight_empty_kg) ?? null;
  if (body.weight_operating_kg !== undefined) data.weight_operating_kg = num(body.weight_operating_kg) ?? null;
  if (body.service_description !== undefined) data.service_description = str(body.service_description) ?? null;
  if (body.fluid_service !== undefined) data.fluid_service = str(body.fluid_service) ?? null;
  if (body.criticality !== undefined) data.criticality = str(body.criticality) ?? null;
  if (body.maintenance_strategy !== undefined) data.maintenance_strategy = str(body.maintenance_strategy) ?? null;
  if (body.inspection_interval_months !== undefined) data.inspection_interval_months = num(body.inspection_interval_months) ?? null;
  if (body.p_and_id_numbers !== undefined) data.p_and_id_numbers = Array.isArray(body.p_and_id_numbers) ? body.p_and_id_numbers : [];
  if (body.ga_drawing_number !== undefined) data.ga_drawing_number = str(body.ga_drawing_number) ?? null;
  if (body.isometric_drawing_numbers !== undefined) data.isometric_drawing_numbers = Array.isArray(body.isometric_drawing_numbers) ? body.isometric_drawing_numbers : [];
  if (body.plot_area !== undefined) data.plot_area = str(body.plot_area) ?? null;
  if (body.elevation !== undefined) data.elevation = str(body.elevation) ?? null;
  if (body.train !== undefined) data.train = str(body.train) ?? null;
  if (body.sap_functional_location !== undefined) data.sap_functional_location = str(body.sap_functional_location) ?? null;
  const asset = await prisma.asset.update({
    where: { id: assetId },
    data: data as any,
    include: { site: { select: { id: true, name: true, code: true } }, system: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json({ data: asset });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { assetId } = await params;
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const activeWorkpacks = await prisma.workpack.count({
    where: { asset_id: assetId, deleted_at: null, status: { notIn: ['cancelled', 'closed'] } },
  });
  if (activeWorkpacks > 0) return NextResponse.json({ error: 'Cannot delete asset with active workpacks' }, { status: 400 });
  await prisma.asset.update({
    where: { id: assetId },
    data: { deleted_at: new Date() },
  });
  return NextResponse.json({ ok: true });
}
