import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { unitId } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organization_id: orgId },
    select: { id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  const list = await prisma.unitResponsibility.findMany({
    where: { unit_id: unitId, is_active: true },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { role: 'asc' },
  });
  return NextResponse.json({ data: list });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { unitId } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organization_id: orgId },
    select: { id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body?.user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  if (!body?.role?.trim()) return NextResponse.json({ error: 'role is required' }, { status: 400 });
  const user = await prisma.user.findFirst({
    where: { id: body.user_id, organization_id: orgId },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const role = String(body.role).trim();
  const existing = await prisma.unitResponsibility.findUnique({
    where: { unit_id_user_id_role: { unit_id: unitId, user_id: body.user_id, role } },
  });
  if (existing) {
    if (existing.is_active) return NextResponse.json({ error: 'This user already has this role on the unit' }, { status: 409 });
    const updated = await prisma.unitResponsibility.update({
      where: { id: existing.id },
      data: {
        is_active: true,
        valid_to: null,
        receives_shift_reports: body.receives_shift_reports ?? false,
        receives_constraint_alerts: body.receives_constraint_alerts ?? false,
        receives_daily_briefing: body.receives_daily_briefing ?? false,
        receives_overdue_alerts: body.receives_overdue_alerts ?? false,
        created_by: userId,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ data: updated }, { status: 201 });
  }
  const resp = await prisma.unitResponsibility.create({
    data: {
      organization_id: orgId,
      unit_id: unitId,
      user_id: body.user_id,
      role,
      receives_shift_reports: body.receives_shift_reports ?? false,
      receives_constraint_alerts: body.receives_constraint_alerts ?? false,
      receives_daily_briefing: body.receives_daily_briefing ?? false,
      receives_overdue_alerts: body.receives_overdue_alerts ?? false,
      created_by: userId,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ data: resp }, { status: 201 });
}
