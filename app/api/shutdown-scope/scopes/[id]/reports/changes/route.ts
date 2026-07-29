import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeChangeService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const items = await ScopeChangeService.listChangeRequests(orgId, id);
  return NextResponse.json({ report: 'change_log', data: items, total: items.length });
}
