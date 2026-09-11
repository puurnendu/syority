/**
 * GET /api/events/[eventId]/management/recommendations/[recommendationId]
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DecisionIntelligenceService } from '@/core/m15/DecisionIntelligenceService';
import { DecisionContextError } from '@/core/m15/types';

export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  const { eventId, recommendationId } = await params;
  const orgId = session.user.organization_id;
  try {
    const rec = await DecisionIntelligenceService.getRecommendation(orgId, eventId, recommendationId);
    if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    return NextResponse.json({ data: rec });
  } catch (err: unknown) {
    if (err instanceof DecisionContextError) {
      return NextResponse.json({ error: err.message }, { status: err.code === 'EVENT_REQUIRED' ? 400 : 404 });
    }
    return NextResponse.json({ error: 'Failed to load recommendation' }, { status: 500 });
  }
});
