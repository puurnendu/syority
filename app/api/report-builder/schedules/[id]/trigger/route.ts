import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportScheduleService } from '@/core/report-builder';

/**
 * POST /api/report-builder/schedules/[id]/trigger — trigger schedule now
 */
export const POST = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const { id } = await ctx.params;
  try {
    const result = await ReportScheduleService.trigger(id, session.user.organization_id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
