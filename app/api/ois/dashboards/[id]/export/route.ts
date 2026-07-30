/**
 * M7.6C — Dashboard Export API
 * POST — Generate dashboard snapshot (PDF/HTML/Excel)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardSnapshotService } from '@/core/ois';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('ois:export.pdf');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const result = await DashboardSnapshotService.generate({
    dashboardId: id,
    organizationId: orgId,
    outputFormat: body.outputFormat ?? 'html',
    generatedBy: userId,
    brandingProfileId: body.brandingProfileId,
    retentionDays: body.retentionDays,
  });

  return NextResponse.json({ data: result }, { status: 201 });
}
