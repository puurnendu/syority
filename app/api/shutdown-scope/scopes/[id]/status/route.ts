import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ShutdownScopeService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();
  if (!body.status) return NextResponse.json({ error: 'status required' }, { status: 400 });
  const result = await ShutdownScopeService.changeStatus(orgId, id, body.status, userId, body.notes);
  return NextResponse.json(result);
}
