import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectWbsError, ProjectWbsService } from '@/core/project/ProjectWbsService';

/**
 * PROJECT WBS — Project-owned. Does not resolve Event.
 */
export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  try {
    const { flat, tree } = await ProjectWbsService.list(orgId, projectId);
    return NextResponse.json({ data: flat, tree, flat });
  } catch (err) {
    if (err instanceof ProjectWbsError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const node = await ProjectWbsService.create(orgId, projectId, {
      name: String(body.name ?? ''),
      code: body.code,
      parent_id: body.parent_id ?? null,
      order: body.order,
    });
    return NextResponse.json({ data: node }, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectWbsError) {
      const status = err.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
});
