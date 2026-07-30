/**
 * M7.6C — OIS Dashboard Widget Instance API
 *
 * PATCH  — Update widget configuration (position, styling, data config)
 * DELETE — Remove widget from dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wid: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;

  const { wid } = await params;
  const body = await req.json();

  const widget = await DashboardService.updateWidget(wid, body);
  return NextResponse.json({ data: widget });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wid: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;

  const { wid } = await params;
  await DashboardService.removeWidget(wid);

  return NextResponse.json({ data: { deleted: true } });
}
