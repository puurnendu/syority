import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import { withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

/**
 * POST /api/hierarchy/resolve
 * Resolves human-readable names/codes to UUIDs.
 * Body: { site?: string, plant?: string, area?: string, unit?: string, system?: string, asset?: string }
 */
export async function POST(req: NextRequest) {
  const { error, orgId } = await withHierarchyGuard('site.view');
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const { site, plant, area, unit, system, asset } = body as Record<string, string>;

    if (!site && !plant && !area && !unit && !system && !asset) {
      return NextResponse.json(
        { error: 'At least one name/code must be provided (site, plant, area, unit, system, asset)' },
        { status: 400 }
      );
    }

    const resolved = await HierarchyService.resolveNamesToIds(orgId, {
      site, plant, area, unit, system, asset,
    });

    return NextResponse.json(resolved);
  } catch (e) {
    console.error('[hierarchy/resolve]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
