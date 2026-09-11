import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

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

    const audits = await prisma.auditLog.findMany({
      where: {
        organization_id: orgId,
        auditable_type: 'Activity',
        auditable_id: activityId,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const formatted = audits
      .filter(a => a.new_values && (a.new_values as any).execution_action)
      .map(a => {
        const nv = a.new_values as any;
        return {
          id: a.id,
          created_at: a.created_at,
          action: nv.execution_action,
          progress: nv.progress_percent,
          source_channel: nv.source_channel,
          notes: nv.notes || '',
          audit: {
            user: { email: a.user_email },
          }
        };
      });

    return NextResponse.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('[API ExecutionHistory] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
