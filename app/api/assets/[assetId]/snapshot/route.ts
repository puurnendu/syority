/**
 * GET  /api/assets/[assetId]/snapshot — Asset snapshot data (scoped to tenant)
 * POST /api/assets/[assetId]/snapshot — Create new snapshot (scoped to tenant)
 *
 * Tenant-scoped via orgScope + asset ownership + workpack relationship.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { WorkpackAssetSnapshotService } from '@/core/asset-register';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: verify asset ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Get all snapshots for this asset, strictly scoped through Workpack organization
    const snapshots = await prisma.workpackAssetSnapshot.findMany({
      where: {
        asset_id: assetId,
        workpack: { organization_id: orgId },
      },
      orderBy: { snapshotted_at: 'desc' },
      select: {
        id: true,
        workpack_id: true,
        snapshot_revision: true,
        snapshotted_at: true,
        snapshotted_by: true,
      },
    });

    return NextResponse.json({ data: snapshots });
  } catch (error: any) {
    console.error('[GET /api/assets/[assetId]/snapshot]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: verify asset ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const body = await request.json();
    const { workpack_id, snapshot_revision } = body;

    if (!workpack_id || !snapshot_revision) {
      return NextResponse.json({ error: 'workpack_id and snapshot_revision are required' }, { status: 400 });
    }

    // Tenant isolation: verify workpack ownership at the API level
    const workpack = await prisma.workpack.findFirst({
      where: { id: workpack_id, organization_id: orgId },
      select: { id: true },
    });
    if (!workpack) {
      return NextResponse.json({ error: 'Workpack not found or belongs to another organization' }, { status: 404 });
    }

    const snapshotData = await WorkpackAssetSnapshotService.createSnapshot({
      workpack_id,
      asset_id: assetId,
      snapshot_revision,
      snapshotted_by: session!.user.id,
    });

    return NextResponse.json({ data: snapshotData }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/assets/[assetId]/snapshot]', error);
    return NextResponse.json({ error: error.message || 'Failed to create snapshot' }, { status: 500 });
  }
}
