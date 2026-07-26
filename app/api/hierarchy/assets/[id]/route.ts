import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import { hierarchyErrorResponse, withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('asset.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const asset = await HierarchyService.updateAsset(id, orgId, userId, body);
    return NextResponse.json(asset);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('asset.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const asset = await HierarchyService.softDeleteAsset(id, orgId, userId);
    return NextResponse.json(asset);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}
