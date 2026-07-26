import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import { hierarchyErrorResponse, withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('system.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const system = await HierarchyService.updateSystem(id, orgId, userId, body);
    return NextResponse.json(system);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('system.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const system = await HierarchyService.softDeleteSystem(id, orgId, userId);
    return NextResponse.json(system);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}
