/**
 * GET /api/assets/[assetId]/audit — Asset audit log
 *
 * Returns audit entries for this specific asset.
 * Tenant-scoped via orgScope + asset ownership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const logs = await (prisma as any).auditLog.findMany({
      where: {
        organization_id: orgId,
        auditable_id: assetId,
        auditable_type: { in: ['Asset', 'AssetAttributeValue', 'AssetAttributeHistory'] },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({ data: logs });
  } catch (error: any) {
    console.error('[GET /api/assets/[assetId]/audit]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch audit log' }, { status: 500 });
  }
}
