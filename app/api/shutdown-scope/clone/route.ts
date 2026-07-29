import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeCloneService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const body = await req.json();

  if (!body.from_scope_id || !body.to_event_id || !body.name) {
    return NextResponse.json({ error: 'from_scope_id, to_event_id, and name are required' }, { status: 400 });
  }

  const result = await ScopeCloneService.cloneScope({
    organizationId: orgId,
    fromScopeId: body.from_scope_id,
    toEventId: body.to_event_id,
    name: body.name,
    userId,
  });
  return NextResponse.json(result, { status: 201 });
}
