/**
 * M8.12 — Material Constraint Recalculation API
 * POST /api/events/[eventId]/materials/recalculate — Trigger constraint recalculation
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { MaterialReadinessService } from '@/core/materials/MaterialReadinessService';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const constraintsWritten = await MaterialReadinessService.recalculateConstraints(eventId, orgId);
    return NextResponse.json({
      success: true,
      constraints_calculated: constraintsWritten,
      calculated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[POST /materials/recalculate] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
