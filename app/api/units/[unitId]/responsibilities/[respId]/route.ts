import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string; respId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { unitId, respId } = await params;
  const resp = await prisma.unit_responsibilities.findFirst({
    where: { id: respId, unit_id: unitId, unit: { organization_id: orgId } },
    select: { id: true },
  });
  if (!resp) return NextResponse.json({ error: 'Responsibility not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.role !== undefined) data.role = String(body.role).trim();
  if (body.receives_shift_reports !== undefined) data.receives_shift_reports = Boolean(body.receives_shift_reports);
  if (body.receives_constraint_alerts !== undefined) data.receives_constraint_alerts = Boolean(body.receives_constraint_alerts);
  if (body.receives_daily_briefing !== undefined) data.receives_daily_briefing = Boolean(body.receives_daily_briefing);
  if (body.receives_overdue_alerts !== undefined) data.receives_overdue_alerts = Boolean(body.receives_overdue_alerts);
  if (body.valid_to !== undefined) data.valid_to = body.valid_to ? new Date(body.valid_to) : null;
  const updated = await prisma.unit_responsibilities.update({
    where: { id: respId },
    data: data as any,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string; respId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { unitId, respId } = await params;
  const resp = await prisma.unit_responsibilities.findFirst({
    where: { id: respId, unit_id: unitId, unit: { organization_id: orgId } },
    select: { id: true },
  });
  if (!resp) return NextResponse.json({ error: 'Responsibility not found' }, { status: 404 });
  await prisma.unit_responsibilities.update({
    where: { id: respId },
    data: { is_active: false },
  });
  return NextResponse.json({ ok: true });
}
