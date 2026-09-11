import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { CriticalPathIntelligenceService } from '@/core/resources/CriticalPathIntelligenceService';

/**
 * GET /api/events/[eventId]/schedule/critical-path
 * Compute critical path intelligence for this event.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const result = await CriticalPathIntelligenceService.analyze(eventId, orgId);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[GET /schedule/critical-path] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
