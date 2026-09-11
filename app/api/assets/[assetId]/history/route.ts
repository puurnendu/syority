/**
 * GET /api/assets/[assetId]/history — Full asset attribute history
 *
 * Query params: ?limit=100&offset=0
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §18 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AssetRegisterService } from '@/core/asset-register';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: asset ownership check at API level
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const history = await AssetRegisterService.getFullAssetHistory(assetId, orgId, { limit, offset });

    return NextResponse.json({ data: history });
  } catch (error: any) {
    console.error('[GET /api/assets/[assetId]/history]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch asset history' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
