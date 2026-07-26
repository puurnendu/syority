import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import {
  hierarchyErrorResponse,
  parseListParams,
  withHierarchyGuard,
} from '@/core/hierarchy/apiHelpers';

export async function GET(req: NextRequest) {
  const { error, orgId } = await withHierarchyGuard('system.view');
  if (error) return error;
  try {
    const result = await HierarchyService.listSystems(parseListParams(req, orgId));
    return NextResponse.json(result);
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const { error, orgId, userId } = await withHierarchyGuard('system.manage');
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const system = await HierarchyService.createSystem(orgId, userId, body);
    return NextResponse.json(system, { status: 201 });
  } catch (e) {
    return hierarchyErrorResponse(e);
  }
}
