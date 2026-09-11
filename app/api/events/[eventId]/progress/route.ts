/**
 * M8.13 Phase 2 — GET /api/events/[eventId]/progress
 *
 * Returns authoritative event-level execution progress.
 * Uses ProgressAggregationService → ProgressCalculationService.
 *
 * Query params:
 *   ?discipline=1  — include breakdown by discipline
 *   ?contractor=1  — include breakdown by contractor
 *   ?unit=1        — include breakdown by unit
 *   ?equipment_type=1 — include breakdown by equipment type
 *   ?workpack=1    — include breakdown by workpack
 *   ?identical=1   — include identical activity intelligence
 *   ?equipment_drilldown=1 — include equipment drill-down
 *   ?all=1         — include all dimensions
 *   ?summary=1     — return DashboardProgressSummary format
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
    // Verify event belongs to this organization
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const url = new URL(req.url);

    // Summary mode — returns DashboardProgressSummary
    if (url.searchParams.get('summary') === '1') {
      const summary = await ProgressAggregationService.getDashboardSummary(orgId, eventId);
      return NextResponse.json(summary);
    }

    // Parse dimension flags from query params
    const all = url.searchParams.get('all') === '1';

    const options = {
      includeDiscipline: all || url.searchParams.get('discipline') === '1',
      includeContractor: all || url.searchParams.get('contractor') === '1',
      includeUnit: all || url.searchParams.get('unit') === '1',
      includeEquipmentType: all || url.searchParams.get('equipment_type') === '1',
      includeWorkpack: all || url.searchParams.get('workpack') === '1',
      includeIdenticalActivities: all || url.searchParams.get('identical') === '1',
      includeEquipmentDrillDown: url.searchParams.get('equipment_drilldown') === '1',
    };

    const payload = await ProgressAggregationService.getEventProgress(
      orgId,
      eventId,
      options
    );

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[GET /progress] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
});
