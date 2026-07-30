/**
 * M7.6C — TV Mode API
 * POST — Create a new TV session
 * GET  — List active TV sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TVModeService } from '@/core/ois';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('ois:tv_mode');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const sessions = await TVModeService.listActive(orgId);
  return NextResponse.json({ data: sessions });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('ois:tv_mode');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.dashboardId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'dashboardId is required' } },
      { status: 400 },
    );
  }

  const tvSession = await TVModeService.createSession({
    dashboardId: body.dashboardId,
    organizationId: orgId,
    startedBy: userId,
    rotationIntervalSec: body.rotationIntervalSec,
    autoRefreshSec: body.autoRefreshSec,
    durationHours: body.durationHours,
  });

  return NextResponse.json({ data: tvSession }, { status: 201 });
}
