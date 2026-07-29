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
  return NextResponse.json(scope);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();
  const updated = await ShutdownScopeService.updateScope(orgId, id, body, userId);
  return NextResponse.json(updated);
}
