/**
 * M7.6C — OIS Dashboard API
 *
 * GET  — List dashboards for the organization
 * POST — Create a new dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DashboardService } from '@/core/ois';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('ois:dashboard.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url);
  const type = url.searchParams.get('type') as any;
  const category = url.searchParams.get('category') ?? undefined;
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
  const includeTemplates = url.searchParams.get('includeTemplates') === 'true';

  const result = await DashboardService.list(orgId, {
    type,
    category,
    page,
    pageSize,
    includeTemplates,
  });

  return NextResponse.json({ data: result.dashboards, meta: { total: result.total, page, pageSize } });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('ois:dashboard.build');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.name || !body.slug) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'name and slug are required' } }, { status: 400 });
  }

  try {
    const dashboard = await DashboardService.create({
      name: body.name,
      slug: body.slug,
      description: body.description,
      dashboardType: body.dashboardType ?? 'dashboard',
      category: body.category,
      icon: body.icon,
      theme: body.theme,
      layoutConfig: body.layoutConfig,
      brandingProfileId: body.brandingProfileId,
      organizationId: orgId,
      createdBy: userId,
    });

    return NextResponse.json({ data: dashboard }, { status: 201 });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: { code: 'DUPLICATE', message: 'A dashboard with this slug already exists' } }, { status: 409 });
    }
    throw err;
  }
}
