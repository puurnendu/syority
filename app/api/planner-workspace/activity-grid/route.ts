/**
 * GET /api/planner-workspace/activity-grid
 *
 * Returns activity grid data for specified workpacks or entire event.
 * Query: ?workpackId=<uuid> OR ?eventId=<uuid>
 * Supports multiple workpackIds via comma-separated: ?workpackId=id1,id2
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PlannerWorkspaceService } from '@/core/planner-workspace';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { organization_id: string };
  const workpackIdParam = req.nextUrl.searchParams.get('workpackId');
  const eventId = req.nextUrl.searchParams.get('eventId') ?? undefined;

  const workpackIds = workpackIdParam
    ? workpackIdParam.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  if (!workpackIds?.length && !eventId) {
    return NextResponse.json({ error: 'workpackId or eventId required' }, { status: 400 });
  }

  try {
    const rows = await PlannerWorkspaceService.getActivityGrid({
      organizationId: user.organization_id,
      workpackIds,
      eventId,
    });
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
