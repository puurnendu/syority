import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeChangeService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; crId: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { crId } = await params;
  const cr = await ScopeChangeService.getChangeRequest(orgId, crId);
  if (!cr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(cr);
}
