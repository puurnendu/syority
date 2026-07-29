import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueDuplicateService } from '@/core/engineering-issues';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = await req.json();
  const result = await IssueDuplicateService.detectDuplicates(orgId, body.batch_id, body.use_ai !== false);
  return NextResponse.json(result);
}
