import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ReviewService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json();
  if (!body.reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 });

  try {
    const result = await ReviewService.rejectCandidate({
      organizationId: orgId,
      candidateId: id,
      userId,
      reason: body.reason,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Reject failed' }, { status: 400 });
  }
}
