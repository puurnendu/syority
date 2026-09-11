/**
 * GET  /api/assets/[assetId]/attributes/[code]/history — Field-level history
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §18 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AssetRegisterService } from '@/core/asset-register';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string; code: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId, code } = await params;

    // Tenant isolation: asset ownership check at API level
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const history = await AssetRegisterService.getAttributeHistory(assetId, code, orgId);

    return NextResponse.json({ data: history });
  } catch (error: any) {
    console.error('[GET /api/assets/[assetId]/attributes/[code]/history]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attribute history' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
