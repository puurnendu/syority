import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportLayoutService } from '@/core/report-builder';

/**
 * GET  /api/report-builder/layouts — list layouts
 * POST /api/report-builder/layouts — create layout
 */
export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const layouts = await ReportLayoutService.list(session.user.organization_id);
  return NextResponse.json({ layouts });
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:admin');
  if (error) return error;

  const body = await req.json();
  const { name, slug } = body ?? {};
  if (!name || !slug) {
    return NextResponse.json({ error: 'Missing required fields: name, slug' }, { status: 400 });
  }

  const layout = await ReportLayoutService.create({
    ...body,
    organization_id: session.user.organization_id,
    created_by: session.user.id,
  });
  return NextResponse.json({ layout }, { status: 201 });
});
