import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportScheduleService } from '@/core/report-builder';

/**
 * GET  /api/report-builder/schedules — list schedules
 * POST /api/report-builder/schedules — create schedule
 */
export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const schedules = await ReportScheduleService.list(session.user.organization_id);
  return NextResponse.json({ schedules });
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const body = await req.json();
  const { name, definition_id, frequency } = body ?? {};
  if (!name || !definition_id || !frequency) {
    return NextResponse.json(
      { error: 'Missing required fields: name, definition_id, frequency' },
      { status: 400 }
    );
  }

  const schedule = await ReportScheduleService.create({
    ...body,
    organization_id: session.user.organization_id,
    created_by: session.user.id,
  });
  return NextResponse.json({ schedule }, { status: 201 });
});
