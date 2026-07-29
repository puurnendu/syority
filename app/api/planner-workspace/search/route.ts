/**
 * GET /api/planner-workspace/search
 *
 * Cross-entity search within an event (workpacks + activities).
 * Query: ?q=<search>&eventId=<uuid>&limit=<number>
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PlannerWorkspaceService } from '@/core/planner-workspace';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { organization_id: string };
  const q = req.nextUrl.searchParams.get('q');
  const eventId = req.nextUrl.searchParams.get('eventId');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10);

  if (!q || !eventId) {
    return NextResponse.json({ error: 'q and eventId required' }, { status: 400 });
  }

  try {
    const results = await PlannerWorkspaceService.search(
      user.organization_id,
      eventId,
      q,
      Math.min(limit, 50),
    );
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
