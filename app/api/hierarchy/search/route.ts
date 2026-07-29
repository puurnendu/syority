import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService, type HierarchyEntity } from '@/core/hierarchy/HierarchyService';
import { withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

const VALID_LEVELS: HierarchyEntity[] = ['site', 'plant', 'area', 'unit', 'system', 'asset'];

/**
 * GET /api/hierarchy/search?q=CDU&levels=unit,system
 * Cross-level hierarchy search by name or code.
 */
export async function GET(req: NextRequest) {
  const { error, orgId } = await withHierarchyGuard('site.view');
  if (error) return error;

  const query = req.nextUrl.searchParams.get('q') || '';
  const levelsParam = req.nextUrl.searchParams.get('levels') || '';

  if (!query.trim()) {
    return NextResponse.json({ error: 'q (query) is required' }, { status: 400 });
  }

  const levels = levelsParam
    ? (levelsParam.split(',').filter((l) => VALID_LEVELS.includes(l as HierarchyEntity)) as HierarchyEntity[])
    : undefined;

  try {
    const results = await HierarchyService.searchHierarchy(orgId, query, levels);
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[hierarchy/search]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
