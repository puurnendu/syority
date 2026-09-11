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

    const board = await FieldExecutionService.getExecutionBoard(orgId, eventId);
    return NextResponse.json({ data: board });
  } catch (err: any) {
    console.error('[API ExecutionBoard] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
