/**
 * GET /api/assets/[assetId]/attributes — All attribute values with provenance
 * PUT /api/assets/[assetId]/attributes — Batch update attributes
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

    const values = await AssetRegisterService.getAttributeValues(assetId, orgId);

    return NextResponse.json({ data: values });
  } catch (error: any) {
    console.error('[GET /api/assets/[assetId]/attributes]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attribute values' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;
    const body = await request.json();

    // Tenant isolation: asset ownership check at API level
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const { values, source_type = 'manual', reason } = body;

    if (!Array.isArray(values) || values.length === 0) {
      return NextResponse.json({ error: 'values array is required' }, { status: 400 });
    }

    const results = await AssetRegisterService.batchSetAttributeValues(
      assetId,
      values,
      {
        organization_id: orgId,
        user_id: session!.user.id,
        source_type,
        reason,
      }
    );

    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error('[PUT /api/assets/[assetId]/attributes]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update attributes' },
      { status: 500 }
    );
  }
}
