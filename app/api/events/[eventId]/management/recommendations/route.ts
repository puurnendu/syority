/**
 * GET /api/events/[eventId]/management/recommendations
 * In-memory M15 composition of CONSIDER items. Does not persist BRE rows or execute.
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
  const url = new URL(req.url);

  try {
    const data = await DecisionIntelligenceService.getRecommendations(orgId, eventId, {
      priority: url.searchParams.get('priority') || undefined,
      category: url.searchParams.get('category') || undefined,
      activityId: url.searchParams.get('activityId') || undefined,
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    if (err instanceof DecisionContextError) {
      const status = err.code === 'EVENT_REQUIRED' ? 400 : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[GET management/recommendations]', err);
    return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 });
  }
});
