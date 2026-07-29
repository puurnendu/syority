/**
 * GET /api/planner-workspace/rollups
 *
 * Returns hierarchy-level rollup aggregates for an event.
 * Query: ?eventId=<uuid>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RollupEngine } from '@/core/planner-workspace';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { organization_id: string };
  const eventId = req.nextUrl.searchParams.get('eventId');
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });

  try {
    const rollups = await RollupEngine.computeEventRollups(user.organization_id, eventId);
    return NextResponse.json(rollups);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
