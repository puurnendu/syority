/**
 * POST /api/planner-workspace/batch-update
 *
 * Batch update activities/workpacks from the planner workspace grid.
 * Only planner-editable fields are allowed.
 *
 * Body: { updates: [{ id, entity, field, value }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PlannerWorkspaceService } from '@/core/planner-workspace';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { id: string; organization_id: string };

  try {
    const body = await req.json();
    const updates = body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 });
    }

    // Validate each update has required fields
    for (const u of updates) {
      if (!u.id || !u.entity || !u.field) {
        return NextResponse.json(
          { error: 'Each update must have id, entity, and field' },
          { status: 400 }
        );
      }
      if (u.entity !== 'activity' && u.entity !== 'workpack') {
        return NextResponse.json(
          { error: `Invalid entity "${u.entity}". Must be "activity" or "workpack"` },
          { status: 400 }
        );
      }
    }

    const result = await PlannerWorkspaceService.batchUpdate(
      user.organization_id,
      user.id,
      updates,
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
