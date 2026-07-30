import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportGenerationService } from '@/core/report-builder';

/**
 * POST /api/report-builder/preview — preview report as HTML (no audit trail)
 */
export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const body = await req.json();
  const { definition_id, layout_id, selected_sections, parameters, include_ai_summary } = body ?? {};

  if (!definition_id) {
    return NextResponse.json({ error: 'Missing required field: definition_id' }, { status: 400 });
  }

  try {
    const html = await ReportGenerationService.preview({
      definitionId: definition_id,
      organizationId: session.user.organization_id,
      generatedBy: session.user.id,
      layoutId: layout_id,
      selectedSections: selected_sections,
      parameters: parameters ?? {},
      includeAiSummary: include_ai_summary ?? false,
    });

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
