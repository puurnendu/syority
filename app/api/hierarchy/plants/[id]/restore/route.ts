import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import { hierarchyErrorResponse, withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: Ctx) {
  const { error, orgId, userId } = await withHierarchyGuard('plant.manage');
  if (error) return error;
  try {
    const { id } = await context.params;
    const plant = await HierarchyService.restorePlant(id, orgId, userId);
    return NextResponse.json(plant);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}
