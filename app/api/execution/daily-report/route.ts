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
    const eventId = searchParams.get('event_id');
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const shiftType = searchParams.get('shift') || 'day';

    if (!eventId) {
      return NextResponse.json({ error: 'event_id parameter is required' }, { status: 400 });
    }

    const report = await FieldExecutionService.generateDailyExecutionReport(orgId, eventId, dateStr, shiftType);
    return NextResponse.json({ data: report });
  } catch (err: any) {
    console.error('[API DailyExecutionReport] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
