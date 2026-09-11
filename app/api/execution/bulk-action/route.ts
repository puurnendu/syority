import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ExecutionWriteService, ExecutionActionParams } from '@/core/execution/ExecutionWriteService';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('execution.bulk');
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;
    const body = await req.json();

    if (!Array.isArray(body.actions)) {
      return NextResponse.json({ error: 'actions array is required' }, { status: 400 });
    }

    const actionList: ExecutionActionParams[] = body.actions.map((item: any) => ({
      activityId: item.activityId,
      action: item.action,
      progress: item.progress,
      notes: item.notes,
      delayDetails: item.delayDetails,
      hold_reason: item.hold_reason,
      hold_category: item.hold_category,
      force_release: item.force_release,
      override_reason: item.override_reason,
      execution_date: item.execution_date,
      shift: item.shift,
    }));

    const result = await ExecutionWriteService.bulkApplyAction(
      orgId,
      userId,
      actionList,
      { source_channel: body.source_channel || 'api' }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[API BulkActivityAction] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
