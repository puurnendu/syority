import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ReviewService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json().catch(() => ({}));

  try {
    const result = await ReviewService.approveCandidate({
      organizationId: orgId,
      candidateId: id,
      userId,
      edits: body.edits,
      reviewNotes: body.review_notes,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Approve failed' }, { status: 400 });
  }
}
