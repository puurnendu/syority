import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { KnowledgeReviewService } from '@/core/knowledge-engine/KnowledgeReviewService';

const DECISIONS = new Set(['APPROVE', 'MERGE', 'REJECT', 'REQUEST_REVISION']);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardPlatformApi('knowledge.review');
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = String(body.decision || '').toUpperCase();
  if (!DECISIONS.has(decision)) {
    return NextResponse.json(
      { error: 'decision must be APPROVE | MERGE | REJECT | REQUEST_REVISION' },
      { status: 400 }
    );
  }

  try {
    const updated = await KnowledgeReviewService.decide({
      assetId: id,
      decision: decision as any,
      notes: body.notes ? String(body.notes) : undefined,
      reviewerId: (session!.user as any).id,
      mergeTargetId: body.merge_target_id || undefined,
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Review failed' },
      { status: 400 }
    );
  }
}
