/**
 * M8.12 — Material Readiness Dashboard API
 * GET /api/events/[eventId]/materials/readiness
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { MaterialReadinessService } from '@/core/materials/MaterialReadinessService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const data = await MaterialReadinessService.calculateEventReadiness(eventId, orgId);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /materials/readiness] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
