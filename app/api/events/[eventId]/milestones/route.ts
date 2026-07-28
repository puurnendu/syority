import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EventPlanningService } from '@/core/planning/EventPlanningService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = (session.user as any).organization_id;
  const { eventId } = await params;
  try {
    const items = await EventPlanningService.listMilestones(eventId, orgId);
    return NextResponse.json({ items });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 404 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = (session.user as any).organization_id;
  const userId = (session.user as any).id;
  const { eventId } = await params;
  const body = await req.json();
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  try {
    const item = await EventPlanningService.upsertMilestone(eventId, orgId, userId, body);
    return NextResponse.json(item, { status: body.id ? 200 : 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = (session.user as any).organization_id;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await EventPlanningService.deleteMilestone(id, orgId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 400 }
    );
  }
}
