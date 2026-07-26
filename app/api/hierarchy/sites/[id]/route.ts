import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import { hierarchyErrorResponse, withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('site.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const site = await HierarchyService.updateSite(id, orgId, userId, body);
    return NextResponse.json(site);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('site.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const site = await HierarchyService.softDeleteSite(id, orgId, userId);
    return NextResponse.json(site);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}
