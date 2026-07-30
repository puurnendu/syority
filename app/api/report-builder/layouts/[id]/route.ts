import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportLayoutService } from '@/core/report-builder';

/**
 * PUT    /api/report-builder/layouts/[id] — update layout
 * DELETE /api/report-builder/layouts/[id] — soft-delete layout
 */
export const PUT = withTenantGuard(async (req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:admin');
  if (error) return error;

  const { id } = await ctx.params;
  const body = await req.json();
  const layout = await ReportLayoutService.update(id, body, session.user.id);
  return NextResponse.json({ layout });
});

export const DELETE = withTenantGuard(async (_req: NextRequest, ctx, _session) => {
  const { error } = await guardApi('reporting:admin');
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await ReportLayoutService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
