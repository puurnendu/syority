/**
 * GET /api/events/[eventId]/management/risks
 * M15-R1 management risk composition. Session org + path eventId only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DecisionIntelligenceService } from '@/core/m15/DecisionIntelligenceService';
import { DecisionContextError } from '@/core/m15/types';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const data = await DecisionIntelligenceService.getManagementRisks(orgId, eventId);
    return NextResponse.json({ data });
  } catch (err: any) {
    if (err instanceof DecisionContextError) {
      const status = err.code === 'EVENT_REQUIRED' ? 400 : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[GET management/risks]', err);
    return NextResponse.json({ error: 'Failed to load management risks' }, { status: 500 });
  }
});
