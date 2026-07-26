import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const PATCH = withTenantGuard(async (req, { params }, session) => {
  const { error } = await guardApi('admin.edit');
  if (error) return error;
  const orgId = session.user.organization_id;
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.equipmentType.findFirst({
    where: { id, org_id: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const type = await prisma.equipmentType.update({
    where: { id },
    data: {
      name: body.name,
      code: body.code || null,
      description: body.description || null,
    },
  });

  return NextResponse.json({
    ...type,
    orgId: type.org_id,
    isActive: type.is_active,
    defaultNozzleCount: null,
    defaultJointCount: null,
  });
});

export const DELETE = withTenantGuard(async (_req, { params }, session) => {
  const { error } = await guardApi('admin.edit');
  if (error) return error;
  const orgId = session.user.organization_id;
  const { id } = await params;

  const existing = await prisma.equipmentType.findFirst({
    where: { id, org_id: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.equipmentType.update({
    where: { id },
    data: { is_active: false },
  });
  return new NextResponse(null, { status: 204 });
});
