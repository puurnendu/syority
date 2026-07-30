/**
 * M7.6C — Dashboard Publish API
 * POST — Publish or archive a dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.admin');
  if (error) return error;
  const { userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action === 'archive') {
    const dashboard = await DashboardService.archive(id, userId);
    return NextResponse.json({ data: dashboard });
  }

  const dashboard = await DashboardService.publish(id, userId);
  return NextResponse.json({ data: dashboard });
}
