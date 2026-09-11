/**
 * M8.12 — Material Constraints API
 * GET /api/events/[eventId]/materials/constraints — List material constraints
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { MaterialConstraintService } from '@/core/materials/MaterialConstraintService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const data = await MaterialConstraintService.getDashboard(eventId, orgId);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /materials/constraints] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
