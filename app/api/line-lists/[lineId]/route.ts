import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { lineId } = await params;
  const line = await prisma.line_lists.findFirst({
    where: { id: lineId, organization_id: orgId, deleted_at: null },
    include: {
      unit: { select: { id: true, name: true, code: true } },
      system: { select: { id: true, name: true, code: true } },
      from_asset: { select: { id: true, tag_number: true, name: true } },
      to_asset: { select: { id: true, tag_number: true, name: true } },
      joints: { orderBy: { sequence_in_line: 'asc' } },
      asset_connections: { include: { asset: { select: { id: true, tag_number: true, name: true } } } },
    },
  });
  if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  return NextResponse.json({ data: line });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { lineId } = await params;
  const existing = await prisma.line_lists.findFirst({
    where: { id: lineId, organization_id: orgId, deleted_at: null },
    select: { id: true, line_number: true, total_joint_count: true, site_id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Line not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (v != null && typeof v === 'string' ? v.trim() : null);
  const num = (v: unknown) => (v != null && (typeof v === 'number' || !Number.isNaN(Number(v))) ? Number(v) : undefined);
  if (body.line_number !== undefined) data.line_number = str(body.line_number) ?? undefined;
  if (body.unit_id !== undefined) data.unit_id = body.unit_id;
  if (body.system_id !== undefined) data.system_id = body.system_id ?? null;
  if (body.nominal_size_inches !== undefined) data.nominal_size_inches = num(body.nominal_size_inches) ?? null;
  if (body.fluid_service_code !== undefined) data.fluid_service_code = str(body.fluid_service_code) ?? null;
  if (body.sequence_number !== undefined) data.sequence_number = str(body.sequence_number) ?? null;
  if (body.pipe_class !== undefined) data.pipe_class = str(body.pipe_class) ?? null;
  if (body.design_pressure_barg !== undefined) data.design_pressure_barg = num(body.design_pressure_barg) ?? null;
  if (body.design_temp_c !== undefined) data.design_temp_c = num(body.design_temp_c) ?? null;
  if (body.operating_pressure_barg !== undefined) data.operating_pressure_barg = num(body.operating_pressure_barg) ?? null;
  if (body.test_pressure_barg !== undefined) data.test_pressure_barg = num(body.test_pressure_barg) ?? null;
  if (body.insulation_type !== undefined) data.insulation_type = str(body.insulation_type) ?? null;
  if (body.heat_tracing !== undefined) data.heat_tracing = body.heat_tracing ?? null;
  if (body.material !== undefined) data.material = str(body.material) ?? null;
  if (body.from_asset_id !== undefined) data.from_asset_id = body.from_asset_id ?? null;
  if (body.from_nozzle_id !== undefined) data.from_nozzle_id = body.from_nozzle_id ?? null;
  if (body.to_asset_id !== undefined) data.to_asset_id = body.to_asset_id ?? null;
  if (body.to_nozzle_id !== undefined) data.to_nozzle_id = body.to_nozzle_id ?? null;
  if (body.p_and_id_number !== undefined) data.p_and_id_number = str(body.p_and_id_number) ?? null;
  if (body.isometric_number !== undefined) data.isometric_number = str(body.isometric_number) ?? null;
  if (body.total_joint_count !== undefined) data.total_joint_count = Math.max(0, Number(body.total_joint_count) ?? 0);
  if (body.notes !== undefined) data.notes = str(body.notes) ?? null;

  const line = await prisma.line_lists.update({
    where: { id: lineId },
    data: data as any,
    include: {
      Unit: { select: { id: true, name: true, code: true } },
      System: { select: { id: true, name: true, code: true } },
      _count: { select: { joint_masters: true } },
    },
  });

  const newCount = line.total_joint_count ?? 0;
  const existingJoints = await prisma.joint_masters.count({ where: { line_id: lineId } });
  if (newCount !== existingJoints && newCount > 0 && existingJoints === 0) {
    const jointNumbers = Array.from({ length: newCount }, (_, i) =>
      `${line.line_number}-J${String(i + 1).padStart(3, '0')}`
    );
    await prisma.joint_masters.createMany({
      data: jointNumbers.map((joint_number, idx) => ({
        organization_id: orgId,
        site_id: existing.site_id,
        line_id: lineId,
        sequence_in_line: idx + 1,
        joint_number,
        joint_type: 'flanged',
        created_by: userId,
      })),
    });
  }

  return NextResponse.json({ data: line });
}
