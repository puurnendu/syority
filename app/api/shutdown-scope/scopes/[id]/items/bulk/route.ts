import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeItemService } from '@/core/shutdown-scope';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.issue_ids || !Array.isArray(body.issue_ids) || body.issue_ids.length === 0) {
    return NextResponse.json({ error: 'issue_ids array is required' }, { status: 400 });
  }

  const result = await ScopeItemService.bulkAddFromIssues({
    organizationId: orgId,
    scopeId: id,
    issueIds: body.issue_ids,
    userId,
  });
  return NextResponse.json(result);
}
