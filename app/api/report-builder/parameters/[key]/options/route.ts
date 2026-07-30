import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportParameterService } from '@/core/report-builder';

/**
 * GET /api/report-builder/parameters/[key]/options — resolve dynamic options
 */
export const GET = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const { key } = await ctx.params;
  const options = await ReportParameterService.resolveOptions(key, session.user.organization_id);
  return NextResponse.json({ options });
});
