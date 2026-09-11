/**
 * POST /api/workspace/grid
 *
 * Dimension-aware workspace grid API.
 *
 * Accepts a WorkspaceQuery in the request body and returns a
 * paginated, dimension-resolved WorkspaceQueryResult.
 *
 * This endpoint replaces /api/planner-workspace/activity-grid
 * for consumers that need dimension-based filtering, sorting,
 * grouping, and pagination.
 *
 * The old endpoint remains unchanged (backward compatible).
 *
 * AUTHORITY BOUNDARIES:
 *   - Does NOT calculate progress (M8.13 authority)
 *   - Does NOT calculate CPM/schedule (M11 authority)
 *   - Does NOT perform execution writes (M12 ExecutionWriteService authority)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WorkspaceQueryService } from '@/core/workspace';
import type { WorkspaceQuery } from '@/core/workspace';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as { id: string; organization_id: string };

  // ── Parse body ────────────────────────────────────────────────────────
  let body: Partial<WorkspaceQuery>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // ── Validate required fields ──────────────────────────────────────────
  if (!body.eventId) {
    return NextResponse.json(
      { error: 'eventId is required' },
      { status: 400 },
    );
  }

  // ── Build safe query (enforce tenant scope) ───────────────────────────
  const query: WorkspaceQuery = {
    organizationId: user.organization_id, // Always from session — never from body
    eventId: body.eventId,
    filters: body.filters ?? [],
    filterGroups: body.filterGroups ?? [],
    sort: body.sort ?? [],
    groupBy: body.groupBy ?? [],
    page: body.page ?? 1,
    pageSize: body.pageSize ?? 200,
    search: body.search,
    hierarchyContext: body.hierarchyContext,
    dimensions: body.dimensions ?? [],
  };

  // ── Execute ───────────────────────────────────────────────────────────
  try {
    const result = await WorkspaceQueryService.execute(query);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[workspace/grid] Query execution error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
