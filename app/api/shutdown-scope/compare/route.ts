import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeComparisonService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const body = await req.json();

  if (!body.scope_a_id || !body.scope_b_id) {
    return NextResponse.json({ error: 'scope_a_id and scope_b_id are required' }, { status: 400 });
  }

  const result = await ScopeComparisonService.compareScopes(orgId, body.scope_a_id, body.scope_b_id, userId);
  return NextResponse.json(result);
}
