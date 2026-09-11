import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportGenerationService } from '@/core/report-builder';

/**
 * GET /api/report-builder/generations/[id] — get generation details + HTML content
 */
export const GET = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const { id } = await ctx.params;
  const generation = await ReportGenerationService.getGeneration(id, session.user.organization_id);
  if (!generation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ generation });
});
