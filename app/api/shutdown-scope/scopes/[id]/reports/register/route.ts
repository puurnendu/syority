import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeItemService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const result = await ScopeItemService.listItems({ organizationId: orgId, scopeId: id, pageSize: 5000 });
  return NextResponse.json({ report: 'scope_register', ...result });
}
