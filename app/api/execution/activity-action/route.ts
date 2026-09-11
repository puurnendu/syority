import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ExecutionWriteService } from '@/core/execution/ExecutionWriteService';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const body = await req.json();
    if (!body.activityId || !body.action) {
      return NextResponse.json({ error: 'activityId and action are required' }, { status: 400 });
    }

    const actionToPermission: Record<string, any> = {
      RELEASE: 'execution.release',
      START: 'execution.start',
      UPDATE_PROGRESS: 'execution.update',
      REPORT_PROGRESS: 'execution.update',
      REPORT_DELAY: 'execution.delay',
      HOLD: 'execution.hold',
      RESUME: 'execution.start',
      COMPLETE: 'execution.complete',
      VERIFY: 'execution.verify',
      CLOSE: 'execution.close',
    };

    const action = body.action === 'REPORT_PROGRESS' ? 'UPDATE_PROGRESS' : body.action;

    const perm = actionToPermission[body.action] || actionToPermission[action];
    if (!perm) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await guardApi(perm);
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;

    const result = await ExecutionWriteService.applyAction(orgId, userId, {
      activityId: body.activityId,
      action,
      progress: body.progress,
      notes: body.notes,
      delayDetails: body.delayDetails,
      hold_reason: body.hold_reason,
      hold_category: body.hold_category,
      force_release: body.force_release,
      override_reason: body.override_reason,
      execution_date: body.execution_date,
      shift: body.shift,
    }, { source_channel: 'api' });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[API ActivityAction] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
