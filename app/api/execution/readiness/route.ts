import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ExecutionReadinessService } from '@/core/execution/ExecutionReadinessService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  try {
    const { error } = await guardApi('execution.view');
    if (error) return error;

    const orgId = session.user.organization_id;
    const { searchParams } = new URL(req.url);
    const activityId = searchParams.get('activityId');

    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }

    const readiness = await ExecutionReadinessService.evaluateReadiness(orgId, activityId);

    return NextResponse.json({ success: true, data: readiness });
  } catch (err: any) {
    console.error('[API ExecutionReadiness] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
});
