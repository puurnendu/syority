import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { searchParams } = new URL(req.url);
  const unit_id = searchParams.get('unit_id') ?? undefined;
  const system_id = searchParams.get('system_id') ?? undefined;
  const where: { organization_id: string; deleted_at: null; unit_id?: string; system_id?: string } = {
    organization_id: orgId,
    deleted_at: null,
  };
  if (unit_id) where.unit_id = unit_id;
  if (system_id) where.system_id = system_id;
  const lines = await prisma.lineList.findMany({
    where,
    include: {
      unit: { select: { id: true, name: true, code: true } },
      system: { select: { id: true, name: true, code: true } },
      _count: { select: { joints: true } },
    },
    orderBy: { line_number: 'asc' },
  });
  return NextResponse.json({ data: lines });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const body = await req.json().catch(() => null);
  if (!body?.line_number?.trim()) return NextResponse.json({ error: 'line_number is required' }, { status: 400 });
  if (!body?.unit_id) return NextResponse.json({ error: 'unit_id is required' }, { status: 400 });
  if (!body?.site_id) return NextResponse.json({ error: 'site_id is required' }, { status: 400 });
  const unit = await prisma.unit.findFirst({
    where: { id: body.unit_id, organization_id: orgId },
    select: { id: true, site_id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  if (unit.site_id !== body.site_id) return NextResponse.json({ error: 'Unit does not belong to site' }, { status: 400 });
  const lineNumber = String(body.line_number).trim();
  const existingLine = await prisma.lineList.findUnique({
    where: { organization_id_line_number: { organization_id: orgId, line_number: lineNumber } },
    select: { id: true },
  });
  if (existingLine) return NextResponse.json({ error: 'Line already exists' }, { status: 409 });
  const line = await prisma.lineList.create({
    data: {
      organization_id: orgId,
      site_id: body.site_id,
      unit_id: body.unit_id,
      system_id: body.system_id ?? null,
      line_number: lineNumber,
      nominal_size_inches: body.nominal_size_inches != null ? Number(body.nominal_size_inches) : null,
      fluid_service_code: body.fluid_service_code?.trim() ?? null,
      sequence_number: body.sequence_number?.trim() ?? null,
      pipe_class: body.pipe_class?.trim() ?? null,
      design_pressure_barg: body.design_pressure_barg != null ? Number(body.design_pressure_barg) : null,
      design_temp_c: body.design_temp_c != null ? Number(body.design_temp_c) : null,
      operating_pressure_barg: body.operating_pressure_barg != null ? Number(body.operating_pressure_barg) : null,
      test_pressure_barg: body.test_pressure_barg != null ? Number(body.test_pressure_barg) : null,
      insulation_type: body.insulation_type?.trim() ?? null,
      heat_tracing: body.heat_tracing ?? false,
      material: body.material?.trim() ?? null,
      from_asset_id: body.from_asset_id ?? null,
      from_nozzle_id: body.from_nozzle_id ?? null,
      to_asset_id: body.to_asset_id ?? null,
      to_nozzle_id: body.to_nozzle_id ?? null,
      p_and_id_number: body.p_and_id_number?.trim() ?? null,
      isometric_number: body.isometric_number?.trim() ?? null,
      total_joint_count: body.total_joint_count ?? 0,
      notes: body.notes?.trim() ?? null,
      created_by: userId,
    },
    include: { unit: { select: { id: true, name: true, code: true } }, system: { select: { id: true, name: true, code: true } } },
  });
  const totalJointCount = line.total_joint_count ?? 0;
  if (totalJointCount > 0) {
    const existingJoints = await prisma.jointMaster.count({ where: { line_id: line.id } });
    if (existingJoints === 0) {
      const jointNumbers = Array.from({ length: totalJointCount }, (_, i) =>
        lineNumber + '-J' + String(i + 1).padStart(3, '0')
      );
      await prisma.jointMaster.createMany({
        data: jointNumbers.map((joint_number, idx) => ({
          organization_id: orgId,
          site_id: body.site_id,
          line_id: line.id,
          sequence_in_line: idx + 1,
          joint_number,
          joint_type: 'flanged',
          created_by: userId,
        })),
      });
    }
  }
  return NextResponse.json({ data: line }, { status: 201 });
}
