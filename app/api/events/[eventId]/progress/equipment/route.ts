/**
 * M8.13 Phase 2 — GET /api/events/[eventId]/progress/equipment
 *
 * Equipment type drill-down endpoint.
 * Returns all equipment types → assets → activities with progress.
 *
 * Query params:
 *   ?type=Heat+Exchanger — filter by specific equipment type
 *
 * Security: withTenantGuard + guardApi('nav.schedule')
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const orgId = session.user.organization_id;
  const { eventId } = await params;

  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const typeFilter = url.searchParams.get('type') ?? undefined;

    const data = await ProgressAggregationService.getEquipmentDrillDown(
      orgId,
      eventId,
      typeFilter
    );

    return NextResponse.json({ eventId, equipmentTypes: data, calculatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[GET /progress/equipment] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
});
