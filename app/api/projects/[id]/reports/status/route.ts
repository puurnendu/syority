import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectReportError, ProjectReportService } from '@/core/project/ProjectReportService';

export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  try {
    const data = await ProjectReportService.status(orgId, projectId);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ProjectReportError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});
