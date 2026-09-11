/**
 * GET /api/admin/audit — Organization-wide audit log
 *
 * Query params: ?limit=50&offset=0&model=Asset&action=updated
 *
 * Tenant-scoped via orgScope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await guardApi('admin.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const model = url.searchParams.get('model');
    const action = url.searchParams.get('action');

    const where: any = { organization_id: orgId };
    if (model) where.auditable_type = model;
    if (action) where.event = action;

    const logs = await (prisma as any).auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return NextResponse.json({ data: logs });
  } catch (error: any) {
    console.error('[GET /api/admin/audit]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch audit log' }, { status: 500 });
  }
}
