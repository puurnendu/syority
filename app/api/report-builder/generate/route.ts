import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportGenerationService } from '@/core/report-builder';

/**
 * POST /api/report-builder/generate — generate a report
 */
export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const body = await req.json();
  const { definition_id, output_format, layout_id, selected_sections, parameters, include_ai_summary } = body ?? {};

  if (!definition_id) {
    return NextResponse.json({ error: 'Missing required field: definition_id' }, { status: 400 });
  }

  const result = await ReportGenerationService.generate({
    definitionId: definition_id,
    organizationId: session.user.organization_id,
    generatedBy: session.user.id,
    outputFormat: output_format ?? 'html',
    layoutId: layout_id,
    selectedSections: selected_sections,
    parameters: parameters ?? {},
    includeAiSummary: include_ai_summary ?? false,
  });

  if (result.status === 'failed') {
    return NextResponse.json({ error: result.error, generationId: result.generationId }, { status: 500 });
  }

  return NextResponse.json(result, { status: 201 });
});
