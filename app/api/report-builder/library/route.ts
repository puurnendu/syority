import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportCategoryService, ReportDefinitionService } from '@/core/report-builder';

/**
 * GET /api/report-builder/library — full report library grouped by category
 */
export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const [categories, definitions] = await Promise.all([
    ReportCategoryService.list(),
    ReportDefinitionService.list(session.user.organization_id),
  ]);

  // Group definitions by category
  const library = categories.map((cat) => ({
    ...cat,
    definitions: definitions.filter((d) => d.category.id === cat.id),
  }));

  return NextResponse.json({ library });
});
