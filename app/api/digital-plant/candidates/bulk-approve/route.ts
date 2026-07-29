import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ReviewService } from '@/core/digital-plant';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!Array.isArray(body.candidate_ids) || body.candidate_ids.length === 0) {
    return NextResponse.json({ error: 'candidate_ids array is required' }, { status: 400 });
  }

  const results = await ReviewService.bulkApprove(orgId, body.candidate_ids, userId);
  return NextResponse.json({ results });
}
