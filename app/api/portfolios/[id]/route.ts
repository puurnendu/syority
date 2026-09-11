import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { PortfolioAccessError, PortfolioService } from '@/core/project/PortfolioService';

export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  try {
    const data = await PortfolioService.get(orgId, id);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PortfolioAccessError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const data = await PortfolioService.update(orgId, id, {
      name: body.name,
      code: body.code,
      description: body.description,
      status: body.status,
      owner_user_id: body.owner_user_id,
      category: body.category,
      start_date: body.start_date ? new Date(body.start_date) : undefined,
      finish_date: body.finish_date ? new Date(body.finish_date) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PortfolioAccessError) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
});

export const DELETE = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  try {
    const data = await PortfolioService.archive(orgId, id);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PortfolioAccessError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});
