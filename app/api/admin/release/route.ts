/**
 * M7.6G — Release Info API
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { releaseService } from '@/core/platform/ReleaseService';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const info = await releaseService.getReleaseInfo();
  return NextResponse.json(info);
}
