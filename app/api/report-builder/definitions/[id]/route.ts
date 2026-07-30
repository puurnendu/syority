import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportDefinitionService } from '@/core/report-builder';

/**
 * GET    /api/report-builder/definitions/[id]   — get definition details
 * PUT    /api/report-builder/definitions/[id]   — update definition
 * DELETE /api/report-builder/definitions/[id]   — soft-delete
 */
export const GET = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const { id } = await ctx.params;
  const definition = await ReportDefinitionService.getById(id);
  if (!definition) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ definition });
});

export const PUT = withTenantGuard(async (req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:admin');
  if (error) return error;

  const { id } = await ctx.params;
  const body = await req.json();
  const definition = await ReportDefinitionService.update(id, body, session.user.id);
  return NextResponse.json({ definition });
});

export const DELETE = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:admin');
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await ReportDefinitionService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
