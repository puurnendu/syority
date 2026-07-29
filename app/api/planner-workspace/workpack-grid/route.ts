/**
 * GET /api/planner-workspace/workpack-grid
 *
 * Returns workpack grid data for a given event, optionally filtered by unit/system/asset.
 * Query: ?eventId=<uuid>&unitId=<uuid>&systemId=<uuid>&assetId=<uuid>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PlannerWorkspaceService } from '@/core/planner-workspace';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { organization_id: string };
  const eventId = req.nextUrl.searchParams.get('eventId');
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });

  const unitId = req.nextUrl.searchParams.get('unitId') ?? undefined;
  const systemId = req.nextUrl.searchParams.get('systemId') ?? undefined;
  const assetId = req.nextUrl.searchParams.get('assetId') ?? undefined;

  try {
    const rows = await PlannerWorkspaceService.getWorkpackGrid({
      organizationId: user.organization_id,
      eventId,
      unitId,
      systemId,
      assetId,
    });
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
