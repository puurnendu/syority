import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeChangeService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; crId: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id, crId } = await params;
  const body = await req.json();
  const result = await ScopeChangeService.rejectChangeRequest(orgId, id, crId, userId, body.notes);
  return NextResponse.json(result);
}
