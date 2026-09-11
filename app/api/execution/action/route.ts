import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ExecutionWriteService } from '@/core/execution/ExecutionWriteService';
import type { ExecutionActionParams } from '@/core/execution/ExecutionWriteService';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('workpacks.edit');
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;
    const body: ExecutionActionParams = await req.json();

    if (!body.activityId && !(body as any).activityIds) {
      return NextResponse.json({ error: 'activityId or activityIds are required' }, { status: 400 });
    }

    if (!body.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const activityIds = (body as any).activityIds || [body.activityId];
    const results = [];
    
    for (const id of activityIds) {
      const result = await ExecutionWriteService.applyAction(orgId, userId, { ...body, activityId: id }, {
        source_channel: 'web'
      });
      results.push(result);
    }

    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[API ExecutionAction] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
