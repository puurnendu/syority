import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ResourceLevelingApplyService, ApplyLevelingRequest } from '@/core/resources/ResourceLevelingApplyService';

export const POST = withTenantGuard(async (req: NextRequest, ctx, session) => {
  try {
    const orgId = session.user.organization_id;
    const userId = session.user.id || 'system';
    const { eventId } = await ctx.params;

    const payload: ApplyLevelingRequest = await req.json();

    if (!payload.simulation_id || !Array.isArray(payload.recommendations)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await ResourceLevelingApplyService.applyRecommendations(eventId, orgId, userId, payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Resource Leveling Apply Error:', error);

    if (error.message && error.message.includes('STALE_RECOMMENDATION')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
    if (error.message === 'Event not found or access denied') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
