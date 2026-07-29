import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueMatchingService } from '@/core/engineering-issues';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  const result = await IssueMatchingService.matchBatch(orgId, body.batch_id ?? null, userId);
  return NextResponse.json(result);
}
