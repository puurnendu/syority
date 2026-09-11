import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { ShutdownScopeService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.workpack_id) {
    return NextResponse.json({ error: 'workpack_id is required' }, { status: 400 });
  }

  const scope = await ShutdownScopeService.getScope(orgId, id);
  if (!scope) return NextResponse.json({ error: 'Scope not found' }, { status: 404 });

  const wp = await prisma.workpack.findFirst({
    where: { id: body.workpack_id, organization_id: orgId }
  });

  if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

  const allowedStatuses = ['approved', 'issued', 'in_execution', 'completed', 'closed'];
  if (!allowedStatuses.includes(wp.status)) {
    return NextResponse.json({ error: `Workpack must be at least approved to bind to scope (current: ${wp.status})` }, { status: 400 });
  }

  await prisma.workpack.update({
    where: { id: wp.id },
    data: { event_id: scope.event_id }
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.workpack_id) {
    return NextResponse.json({ error: 'workpack_id is required' }, { status: 400 });
  }

  const scope = await ShutdownScopeService.getScope(orgId, id);
  if (!scope) return NextResponse.json({ error: 'Scope not found' }, { status: 404 });

  const wp = await prisma.workpack.findFirst({
    where: { id: body.workpack_id, organization_id: orgId, event_id: scope.event_id }
  });

  if (!wp) return NextResponse.json({ error: 'Workpack not found in this scope' }, { status: 404 });

  if (['issued', 'in_execution', 'completed', 'closed'].includes(wp.status)) {
      return NextResponse.json({ error: `Cannot unbind workpack in status ${wp.status}` }, { status: 400 });
  }

  await prisma.workpack.update({
    where: { id: wp.id },
    data: { event_id: null }
  });

  return NextResponse.json({ success: true });
}
