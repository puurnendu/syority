import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService, type HierarchyEntity } from '@/core/hierarchy/HierarchyService';
import { withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

const VALID_LEVELS: HierarchyEntity[] = ['site', 'plant', 'area', 'unit', 'system', 'asset'];

/**
 * GET /api/hierarchy/children?level=plant&parentId=<uuid>
 * Lazy-loads one level of hierarchy children.
 */
export async function GET(req: NextRequest) {
  const { error, orgId } = await withHierarchyGuard('site.view');
  if (error) return error;

  const level = req.nextUrl.searchParams.get('level') as HierarchyEntity;
  const parentId = req.nextUrl.searchParams.get('parentId') || undefined;

  if (!level || !VALID_LEVELS.includes(level)) {
    return NextResponse.json(
      { error: `Invalid level. Must be one of: ${VALID_LEVELS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const items = await HierarchyService.loadChildren(orgId, level, parentId);
    return NextResponse.json({ items });
  } catch (e) {
    console.error('[hierarchy/children]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
