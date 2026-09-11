import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { PortfolioService } from '@/core/project/PortfolioService';

export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const data = await PortfolioService.list(orgId);
  return NextResponse.json({ data });
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const body = await req.json().catch(() => ({}));
  try {
    const portfolio = await PortfolioService.create(orgId, {
      name: String(body.name ?? ''),
      code: String(body.code ?? ''),
      description: body.description ?? null,
      status: body.status,
      owner_user_id: body.owner_user_id ?? null,
      category: body.category ?? null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      finish_date: body.finish_date ? new Date(body.finish_date) : null,
    });
    return NextResponse.json({ data: portfolio }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
