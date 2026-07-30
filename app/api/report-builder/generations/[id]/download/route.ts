import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportGenerationService } from '@/core/report-builder';

/**
 * GET /api/report-builder/generations/[id]/download — download report as HTML file
 */
export const GET = withTenantGuard(async (_req: NextRequest, ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const { id } = await ctx.params;
  const generation = await ReportGenerationService.getGeneration(id);
  if (!generation || !generation.html_content) {
    return NextResponse.json({ error: 'Not found or no content' }, { status: 404 });
  }

  const filename = generation.resolved_filename ?? `report-${id}.html`;

  return new NextResponse(generation.html_content, {
    status: 200,
    headers: {
      'Content-Type': generation.output_format === 'csv' ? 'text/csv' : 'text/html',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
