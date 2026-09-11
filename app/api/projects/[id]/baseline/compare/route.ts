import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectBaselineCompareService, ProjectBaselineError } from '@/core/project/ProjectBaselineCompareService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  const baselineId = new URL(req.url).searchParams.get('baselineId');
  if (!baselineId) return NextResponse.json({ error: 'baselineId is required' }, { status: 400 });
  try {
    const data = await ProjectBaselineCompareService.compare(orgId, projectId, baselineId);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ProjectBaselineError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});
