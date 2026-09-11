/**
 * POST /api/assets/[assetId]/attributes/[code]/review — Accept/Modify/Reject AI extraction
 *
 * Body: { historyId: string, decision: 'accept'|'modify'|'reject', corrected_value?: ..., reason?: string }
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §18 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AssetRegisterService, type ReviewDecision } from '@/core/asset-register';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string; code: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { assetId } = await params;

    // Tenant isolation: asset ownership check at API level
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const body = await request.json();
    const { historyId, decision, corrected_value, reason } = body;

    if (!historyId || !decision) {
      return NextResponse.json({ error: 'historyId and decision are required' }, { status: 400 });
    }

    const validDecisions: ReviewDecision[] = ['accept', 'modify', 'reject'];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json({ error: `decision must be one of: ${validDecisions.join(', ')}` }, { status: 400 });
    }

    await AssetRegisterService.reviewAiExtraction(
      historyId,
      decision,
      session!.user.id,
      orgId,
      { corrected_value, reason }
    );

    return NextResponse.json({ data: { success: true, decision } });
  } catch (error: any) {
    console.error('[POST /api/assets/[assetId]/attributes/[code]/review]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to review AI extraction' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}
