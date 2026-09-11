import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectReportError, ProjectReportService } from '@/core/project/ProjectReportService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  const days = parseInt(new URL(req.url).searchParams.get('days') || '7', 10);
  try {
    const data = await ProjectReportService.lookahead(orgId, projectId, Number.isFinite(days) ? days : 7);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ProjectReportError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});
