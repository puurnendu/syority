import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportScheduleService } from '@/core/report-builder';

/**
 * PUT    /api/report-builder/schedules/[id]         — update schedule
 * DELETE /api/report-builder/schedules/[id]         — delete schedule
 */
export const PUT = withTenantGuard(async (req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const { id } = await ctx.params;
  const body = await req.json();
  const schedule = await ReportScheduleService.update(id, body, session.user.id, session.user.organization_id);
  return NextResponse.json({ schedule });
});

export const DELETE = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const { id } = await ctx.params;
  await ReportScheduleService.delete(id, session.user.organization_id);
  return NextResponse.json({ success: true });
});
