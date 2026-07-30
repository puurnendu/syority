import { NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportCategoryService } from '@/core/report-builder';

/**
 * GET /api/report-builder/categories — list report categories
 */
export const GET = withTenantGuard(async (_req, _ctx, _session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const categories = await ReportCategoryService.list();
  return NextResponse.json({ categories });
});
