import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ReportDefinitionService } from '@/core/report-builder';

/**
 * GET  /api/report-builder/definitions          — list definitions for tenant
 * POST /api/report-builder/definitions          — create definition (admin)
 */
export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') ?? undefined;

  const definitions = await ReportDefinitionService.list(
    session.user.organization_id,
    category
  );
  return NextResponse.json({ definitions });
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:admin');
  if (error) return error;

  const body = await req.json();
  const { slug, name, category_id, data_source_key, ...rest } = body ?? {};

  if (!slug || !name || !category_id || !data_source_key) {
    return NextResponse.json(
      { error: 'Missing required fields: slug, name, category_id, data_source_key' },
      { status: 400 }
    );
  }

  const definition = await ReportDefinitionService.create({
    slug,
    name,
    category_id,
    data_source_key,
    ...rest,
    organization_id: session.user.organization_id,
    created_by: session.user.id,
  });

  return NextResponse.json({ definition }, { status: 201 });
});
