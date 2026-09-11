import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('workpacks.view');
    if (error) return error;

    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id') || undefined;
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const criticalOnly = searchParams.get('critical') === 'true';
    const delayedOnly = searchParams.get('delayed') === 'true';

    const lookahead = await FieldExecutionService.getLookahead(orgId, eventId, hours, {
      critical_only: criticalOnly,
      delayed_only: delayedOnly,
    });

    return NextResponse.json({ data: lookahead, window_hours: hours, count: lookahead.length });
  } catch (err: any) {
    console.error('[API Lookahead] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
