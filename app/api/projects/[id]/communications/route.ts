import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectCommunicationError, ProjectCommunicationService } from '@/core/project/ProjectCommunicationService';

export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  try {
    const data = await ProjectCommunicationService.list(orgId, projectId);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ProjectCommunicationError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await ProjectCommunicationService.create(orgId, projectId, {
      type: body.type,
      subject: String(body.subject ?? ''),
      body: body.body ?? null,
      created_by: userId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectCommunicationError) {
      const status = err.message.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
});
