/**
 * M7.6C — Dashboard Share API
 * GET    — List shares
 * POST   — Add share
 * DELETE — Remove share
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.view');
  if (error) return error;

  const { id } = await params;
  const dashboard = await DashboardService.getById(id, false);

  return NextResponse.json({ data: dashboard.shares });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.admin');
  if (error) return error;
  const { userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json();

  const share = await DashboardService.share(id, {
    sharedWithType: body.sharedWithType,
    sharedWithValue: body.sharedWithValue,
    permission: body.permission,
    createdBy: userId,
  });

  return NextResponse.json({ data: share }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await guardApi('ois:dashboard.admin');
  if (error) return error;

  const url = new URL(req.url);
  const shareId = url.searchParams.get('shareId');
  if (!shareId) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'shareId required' } }, { status: 400 });
  }

  await DashboardService.removeShare(shareId);
  return NextResponse.json({ data: { deleted: true } });
}
