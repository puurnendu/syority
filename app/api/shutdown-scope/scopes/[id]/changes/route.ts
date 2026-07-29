import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeChangeService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const items = await ScopeChangeService.listChangeRequests(orgId, id, searchParams.get('status') ?? undefined);
  return NextResponse.json({ data: items, total: items.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.change_type || !body.title || !body.reason) {
    return NextResponse.json({ error: 'change_type, title, and reason are required' }, { status: 400 });
  }

  const cr = await ScopeChangeService.createChangeRequest({
    organizationId: orgId,
    scopeId: id,
    changeType: body.change_type,
    scopeItemId: body.scope_item_id,
    assetId: body.asset_id,
    title: body.title,
    reason: body.reason,
    justification: body.justification,
    estimatedHours: body.estimated_hours,
    discipline: body.discipline,
    priority: body.priority,
    userId,
  });
  return NextResponse.json(cr, { status: 201 });
}
