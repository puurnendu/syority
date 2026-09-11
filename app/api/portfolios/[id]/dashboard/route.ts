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
    const data = await PortfolioService.dashboard(orgId, id);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PortfolioAccessError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});
