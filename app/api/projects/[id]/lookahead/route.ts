import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { SchedulingService } from '@/modules/Scheduling/Services/SchedulingService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;
  const { searchParams } = new URL(req.url);
  const windowDays = parseInt(searchParams.get('days') || searchParams.get('window') || '7');

  try {
    const raw = await SchedulingService.getLookaheadActivities(projectId, orgId, windowDays);
    const now = new Date();
    const activities = raw
      .filter((a: { status?: string | null }) => String(a.status ?? '').toLowerCase() !== 'complete')
      .map((a: any) => ({
        ...a,
        workpackTitle: a.workpack?.title,
        workpackNumber: a.workpack?.workpack_id_code ?? a.workpack?.workpack_number,
      }));
    const overdue = activities.filter(
      (a: any) => (a.planned_end || a.early_finish) && new Date(a.planned_end || a.early_finish) < now
    );
    const byWindow: Record<string, typeof activities> = {};
    for (const a of activities) {
      const key = a.window ?? 'Unassigned';
      if (!byWindow[key]) byWindow[key] = [];
      byWindow[key].push(a);
    }
    return NextResponse.json({ activities, byWindow, overdue, days: windowDays });
  } catch (err: any) {
    console.error('Lookahead Fetch Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch lookahead activities' },
      { status: 500 }
    );
  }
});
