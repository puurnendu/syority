import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ShutdownScopeService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const scope = await ShutdownScopeService.getScope(orgId, id);
  if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(scope.live_stats);
}
