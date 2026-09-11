import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, ctx: { params: Promise<{ jointId: string }> }) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { jointId } = await ctx.params;
  const joint = await prisma.joint_masters.findFirst({
    where: { id: jointId, organization_id: orgId },
    include: {
      asset: { select: { id: true, tag_number: true, name: true } },
      line: { select: { id: true, line_number: true } },
      nozzle: { select: { id: true, designation: true } },
      integrity_items: {
        take: 20,
        orderBy: { created_at: 'desc' },
        include: { workpack: { select: { id: true, title: true, workpack_id_code: true, status: true } } },
      },
    },
  });
  if (!joint) return NextResponse.json({ error: 'Joint not found' }, { status: 404 });
  return NextResponse.json({ data: joint });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ jointId: string }> }) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { jointId } = await ctx.params;
  const existing = await prisma.joint_masters.findFirst({
    where: { id: jointId, organization_id: orgId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Joint not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (v != null && typeof v === 'string' ? v.trim() : null);
  const num = (v: unknown) => (v != null && (typeof v === 'number' || !Number.isNaN(Number(v))) ? Number(v) : undefined);
  if (body.nominal_size_inches !== undefined) data.nominal_size_inches = num(body.nominal_size_inches) ?? null;
  if (body.pressure_rating !== undefined) data.pressure_rating = str(body.pressure_rating) ?? null;
  if (body.flange_face !== undefined) data.flange_face = str(body.flange_face) ?? null;
  if (body.default_gasket_type !== undefined) data.default_gasket_type = str(body.default_gasket_type) ?? null;
  if (body.default_gasket_material !== undefined) data.default_gasket_material = str(body.default_gasket_material) ?? null;
  if (body.default_bolt_spec !== undefined) data.default_bolt_spec = str(body.default_bolt_spec) ?? null;
  if (body.default_bolt_count !== undefined) data.default_bolt_count = num(body.default_bolt_count) ?? null;
  if (body.default_torque_nm !== undefined) data.default_torque_nm = num(body.default_torque_nm) ?? null;
  if (body.notes !== undefined) data.notes = str(body.notes) ?? null;
  const joint = await prisma.joint_masters.update({
    where: { id: jointId },
    data: data as any,
    include: { asset: { select: { id: true, tag_number: true } }, line: { select: { id: true, line_number: true } } },
  });
  return NextResponse.json({ data: joint });
}
