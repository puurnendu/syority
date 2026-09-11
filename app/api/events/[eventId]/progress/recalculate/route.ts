/**
 * M8.13 Phase 1 — POST /api/events/[eventId]/progress/recalculate
 *
 * Recalculates and syncs Workpack.overall_progress for all workpacks in an event.
 *
 * SAFETY:
 * - Does NOT mutate Activity.progress_percent
 * - Only syncs the cached Workpack.overall_progress field
 * - Uses the authoritative duration-weighted calculation
 *
 * Security: withTenantGuard + guardApi('nav.schedule')
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import { prisma } from '@/lib/prisma';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
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

    const result = await ProgressAggregationService.recalculateEvent(orgId, eventId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /progress/recalculate] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
});
