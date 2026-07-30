import { NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportParameterService } from '@/core/report-builder';

/**
 * GET /api/report-builder/parameters — list all parameters
 */
export const GET = withTenantGuard(async (_req, _ctx, _session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const parameters = await ReportParameterService.list();
  return NextResponse.json({ parameters });
});
