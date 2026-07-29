import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ShutdownScopeService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { searchParams } = new URL(req.url);

  const result = await ShutdownScopeService.listScopes({
    organizationId: orgId,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '25', 10),
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const body = await req.json();

  if (!body.event_id || !body.name) {
    return NextResponse.json({ error: 'event_id and name are required' }, { status: 400 });
  }

  // Get event's site_id
  const { prisma } = await import('@/lib/prisma');
  const event = await prisma.event.findFirst({
    where: { id: body.event_id, organization_id: orgId },
    select: { site_id: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const scope = await ShutdownScopeService.createScope({
    organizationId: orgId,
    eventId: body.event_id,
    siteId: event.site_id,
    name: body.name,
    description: body.description,
    objectives: body.objectives,
    freezeDate: body.freeze_date,
    budgetManhours: body.budget_manhours,
    budgetCost: body.budget_cost,
    userId,
  });
  return NextResponse.json(scope, { status: 201 });
}
