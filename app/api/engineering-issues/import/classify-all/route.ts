import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueClassificationService } from '@/core/engineering-issues';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = await req.json();
  const result = await IssueClassificationService.classifyBatch(orgId, body.batch_id, body.limit ?? 50);
  return NextResponse.json(result);
}
