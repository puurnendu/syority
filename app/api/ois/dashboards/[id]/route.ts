/**
 * M7.6C — OIS Dashboard Detail API
 *
 * GET    — Get dashboard by ID with pages, widgets
 * PATCH  — Update dashboard metadata
 * DELETE — Delete dashboard
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
  try {
    const dashboard = await DashboardService.getById(id);
    return NextResponse.json({ data: dashboard });
  } catch {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Dashboard not found' } }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;
  const { userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json();

  const dashboard = await DashboardService.update(id, {
    name: body.name,
    description: body.description,
    category: body.category,
    icon: body.icon,
    theme: body.theme,
    layoutConfig: body.layoutConfig,
    brandingProfileId: body.brandingProfileId,
    revisionNotes: body.revisionNotes,
    updatedBy: userId,
  });

  return NextResponse.json({ data: dashboard });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:dashboard.admin');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const { id } = await params;
  await DashboardService.delete(id, userId, orgId);

  return NextResponse.json({ data: { deleted: true } });
}
