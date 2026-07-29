import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/core/hierarchy/HierarchyService';
import { withHierarchyGuard } from '@/core/hierarchy/apiHelpers';

/**
 * GET /api/hierarchy/settings
 * Returns tenant hierarchy settings (use_areas toggle).
 */
export async function GET() {
  const { error, orgId } = await withHierarchyGuard('site.view');
  if (error) return error;

  try {
    const settings = await HierarchyService.getOrgSettings(orgId);
    return NextResponse.json(settings);
  } catch (e) {
    console.error('[hierarchy/settings]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/hierarchy/settings
 * Updates tenant hierarchy settings.
 * Body: { use_areas?: boolean }
 */
export async function PUT(req: NextRequest) {
  const { error, orgId, userId } = await withHierarchyGuard('settings.org.view');
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const settings = await HierarchyService.updateOrgSettings(orgId, userId, body);
    return NextResponse.json(settings);
  } catch (e) {
    console.error('[hierarchy/settings]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
