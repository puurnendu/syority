/**
 * M7.6G — Usage Tracking API
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { usageLimitService } from '@/core/Platform/UsageLimitService';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('organizationId');

  if (orgId) {
    const summary = await usageLimitService.getUsageSummary(orgId);
    return NextResponse.json({ usage: summary });
  }

  const stats = await usageLimitService.getPlatformStats();
  return NextResponse.json(stats);
}
