import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectWbsError, ProjectWbsService } from '@/core/project/ProjectWbsService';

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId, nodeId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await ProjectWbsService.update(orgId, projectId, nodeId, {
      name: body.name,
      code: body.code,
      parent_id: body.parent_id,
      order: body.order,
    });
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ProjectWbsError) {
      const status = err.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
});

export const DELETE = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId, nodeId } = await params;
  try {
    await ProjectWbsService.remove(orgId, projectId, nodeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProjectWbsError) {
      const status = err.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
});
