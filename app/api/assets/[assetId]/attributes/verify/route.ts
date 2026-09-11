/**
 * POST /api/assets/[assetId]/attributes/verify — Verify selected attributes
 *
 * Body: { codes: string[] }
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §18 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AssetRegisterService } from '@/core/asset-register';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: asset ownership check at API level
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const body = await request.json();
    const { codes } = body;

    if (!Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'codes array is required' }, { status: 400 });
    }

    const results = await AssetRegisterService.batchVerifyAttributes(
      assetId,
      codes,
      session!.user.id,
      orgId
    );

    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error('[POST /api/assets/[assetId]/attributes/verify]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify attributes' },
      { status: 500 }
    );
  }
}
