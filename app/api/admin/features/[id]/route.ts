import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function isAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return false;
  const user = session.user as any;
  const roles = user.roles ?? [];
  return roles.includes('platform_super_admin') || roles.includes('platform_admin');
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse('Forbidden', { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { description, is_enabled } = body;

    const data: { description?: string | null; isEnabled?: boolean } = {};
    if (description !== undefined) data.description = description;
    if (is_enabled !== undefined) data.isEnabled = !!is_enabled;

    const flag = await prisma.featureFlag.update({
      where: { key: id },
      data,
      include: { _count: { select: { TenantFeature: true } } },
    });

    return NextResponse.json({
      id: flag.key,
      key: flag.key,
      name: flag.key,
      description: flag.description,
      is_enabled: flag.isEnabled,
      _count: { tenant_overrides: flag._count.TenantFeature },
    });
  } catch (error) {
    console.error('[features PATCH]', error);
    return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse('Forbidden', { status: 403 });

  try {
    const { id } = await params;

    await prisma.tenantFeature.deleteMany({
      where: { feature_key: id },
    });

    await prisma.featureFlag.delete({
      where: { key: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[features DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete feature flag' }, { status: 500 });
  }
}
