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
    // 1. Fetch all organizations for MRR and Tier stats
    const organizations = await prisma.organization.findMany({
      where: { is_active: true, deleted_at: null },
      select: {
        plan_tier: true,
        contract_value: true,
        billing_cycle: true,
        payment_status: true,
      }
    });

    // 2. Fetch total lifetime revenue from logs
    const revenueSum = await prisma.billingLog.aggregate({
      _sum: { amount: true }
    });

    let mrr = 0;
    const tierDistribution: Record<string, number> = {};
    let activeSubscriptions = 0;
    let pastDueSubscriptions = 0;

    organizations.forEach(org => {
      // MRR Calculation
      if (org.payment_status === 'active' && org.contract_value) {
        if (org.billing_cycle === 'monthly') {
          mrr += org.contract_value;
        } else if (org.billing_cycle === 'annual') {
          mrr += org.contract_value / 12;
        }
      }

      // Tier Stats
      const tier = org.plan_tier || 'basic';
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;

      // Status Stats
      if (org.payment_status === 'active') activeSubscriptions++;
      if (org.payment_status === 'past_due') pastDueSubscriptions++;
    });

    return NextResponse.json({
      mrr: Math.round(mrr),
      totalRevenue: Math.round(revenueSum._sum.amount || 0),
      activeSubscriptions,
      pastDueSubscriptions,
      tierDistribution,
      totalTenants: organizations.length
    });
  } catch (error) {
    console.error('Failed to fetch billing stats:', error);
    return NextResponse.json({ error: 'Failed to fetch billing statistics' }, { status: 500 });
  }
}
