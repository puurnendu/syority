import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportGenerationService } from '@/core/report-builder';

/**
 * GET /api/report-builder/generations — list generation history
 */
export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const definitionId = searchParams.get('definition_id') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const generations = await ReportGenerationService.listGenerations(
    session.user.organization_id,
    { definitionId, status, limit }
  );
  return NextResponse.json({ generations });
});
