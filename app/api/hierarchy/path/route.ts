import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService, type HierarchyEntity } from '@/core/hierarchy/HierarchyService';
import { withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

const VALID_TYPES: HierarchyEntity[] = ['site', 'plant', 'area', 'unit', 'system', 'asset'];

/**
 * GET /api/hierarchy/path?type=system&id=<uuid>
 * Returns full ancestry path from Site down to the requested entity.
 */
export async function GET(req: NextRequest) {
  const { error, orgId } = await withHierarchyGuard('site.view');
  if (error) return error;

  const type = req.nextUrl.searchParams.get('type') as HierarchyEntity;
  const id = req.nextUrl.searchParams.get('id');

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const path = await HierarchyService.loadPath(orgId, type, id);
    const breadcrumb = HierarchyService.formatPath(path);
    return NextResponse.json({ path, breadcrumb });
  } catch (e) {
    console.error('[hierarchy/path]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
