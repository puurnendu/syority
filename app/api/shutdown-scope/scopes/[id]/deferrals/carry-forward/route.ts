import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeDeferralService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.to_scope_id) {
    return NextResponse.json({ error: 'to_scope_id is required' }, { status: 400 });
  }

  const result = await ScopeDeferralService.carryForward({
    organizationId: orgId,
    fromScopeId: id,
    toScopeId: body.to_scope_id,
    deferralIds: body.deferral_ids,
    userId,
  });
  return NextResponse.json(result);
}
