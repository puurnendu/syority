import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeBuilderService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const result = await ScopeBuilderService.getUnscopedIssues(orgId, id, {
    department: searchParams.get('department') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    priority: searchParams.get('priority') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '50', 10),
  });
  return NextResponse.json(result);
}
