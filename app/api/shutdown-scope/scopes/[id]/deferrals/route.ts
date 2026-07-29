import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeDeferralService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const items = await ScopeDeferralService.listDeferrals(orgId, id);
  return NextResponse.json({ data: items, total: items.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.scope_item_id || !body.reason) {
    return NextResponse.json({ error: 'scope_item_id and reason are required' }, { status: 400 });
  }

  const result = await ScopeDeferralService.deferItem({
    organizationId: orgId,
    scopeId: id,
    scopeItemId: body.scope_item_id,
    reason: body.reason,
    targetEvent: body.target_event,
    targetEventId: body.target_event_id,
    userId,
  });
  return NextResponse.json(result, { status: 201 });
}
