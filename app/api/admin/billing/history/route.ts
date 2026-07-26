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

export async function GET() {
  if (!(await isAdmin())) return new NextResponse('Forbidden', { status: 403 });

  try {
    const logs = await prisma.billingLog.findMany({
      orderBy: { payment_date: 'desc' },
      take: 50,
      include: {
        Organization: {
          select: {
            name: true,
            slug: true,
            plan_tier: true,
          },
        },
      },
    });

    // Normalize PascalCase Prisma relation for the billing UI.
    return NextResponse.json(
      logs.map((log) => ({
        ...log,
        organization: log.Organization,
      }))
    );
  } catch (error) {
    console.error('Failed to fetch billing history:', error);
    return NextResponse.json({ error: 'Failed to fetch billing history' }, { status: 500 });
  }
}
