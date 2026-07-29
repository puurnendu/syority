import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopePackageService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pkgId: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { pkgId } = await params;
  const body = await req.json();

  if (!body.item_ids || !Array.isArray(body.item_ids)) {
    return NextResponse.json({ error: 'item_ids array required' }, { status: 400 });
  }

  const result = await ScopePackageService.assignItems(orgId, pkgId, body.item_ids, userId);
  return NextResponse.json(result);
}
