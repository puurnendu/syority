import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

export const GET = withTenantGuard(async (_req, _ctx, session) => {
  const { error } = await guardApi('admin.view');
  if (error) return error;
  const orgId = session.user.organization_id;

  const types = await prisma.equipmentType.findMany({
    where: {
      org_id: orgId,
      is_active: true,
    },
    orderBy: { name: 'asc' },
  });

  // Normalize for existing UI field names
  return NextResponse.json(
    types.map((t) => ({
      ...t,
      orgId: t.org_id,
      isActive: t.is_active,
      defaultNozzleCount: null,
      defaultJointCount: null,
    }))
  );
});

export const POST = withTenantGuard(async (req, _ctx, session) => {
  const { error } = await guardApi('admin.edit');
  if (error) return error;
  const orgId = session.user.organization_id;
  const body = await req.json();

  const type = await prisma.equipmentType.create({
    data: {
      id: randomUUID(),
      org_id: orgId,
      name: body.name,
      code: body.code || null,
      description: body.description || null,
      is_active: true,
    },
  });

  return NextResponse.json(
    {
      ...type,
      orgId: type.org_id,
      isActive: type.is_active,
      defaultNozzleCount: null,
      defaultJointCount: null,
    },
    { status: 201 }
  );
});
