/**
 * M7.6C — Dashboard Version API
 * GET  — List versions
 * POST — Create version snapshot / restore version
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
  const versions = await DashboardService.listVersions(id);

  return NextResponse.json({ data: versions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;
  const { userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action === 'restore' && body.versionId) {
    const restored = await DashboardService.restoreVersion(body.versionId, userId);
    return NextResponse.json({ data: restored });
  }

  const version = await DashboardService.createVersion(id, userId, body.summary);
  return NextResponse.json({ data: version }, { status: 201 });
}
