import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * PUT    /api/reporting/templates/[id]   — update name or pages
 * DELETE /api/reporting/templates/[id]   — soft delete
 */
export const PUT = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { name, pages } = body ?? {};

  const template = await prisma.report_templates.updateMany({
    where: { id, organization_id: session.user.organization_id, deleted_at: null },
    data: {
      ...(name  !== undefined && { name }),
      ...(pages !== undefined && { pages }),
    },
  });

  if (template.count === 0) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const { id } = await params;
  const result = await prisma.report_templates.updateMany({
    where: { id, organization_id: session.user.organization_id, deleted_at: null },
    data: { deleted_at: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
