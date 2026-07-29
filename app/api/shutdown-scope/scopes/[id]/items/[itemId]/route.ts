import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeItemService } from '@/core/shutdown-scope';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id, itemId } = await params;
  const body = await req.json();
  const result = await ScopeItemService.updateItem(orgId, id, itemId, body, userId);
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id, itemId } = await params;
  const result = await ScopeItemService.removeItem(orgId, id, itemId, userId);
  return NextResponse.json(result);
}
