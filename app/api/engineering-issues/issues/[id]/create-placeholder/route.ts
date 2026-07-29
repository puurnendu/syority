import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueMatchingService } from '@/core/engineering-issues';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json();
  if (!body.site_id) return NextResponse.json({ error: 'site_id required' }, { status: 400 });

  const result = await IssueMatchingService.createPlaceholder(orgId, id, body.site_id, userId);
  return NextResponse.json(result, { status: 201 });
}
