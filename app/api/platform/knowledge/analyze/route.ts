import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { knowledgeEngineQueue } from '@/lib/queues';
import { KnowledgeAnalysisService } from '@/core/knowledge-engine/KnowledgeAnalysisService';

/**
 * Re-run analysis for an asset (or process inline if Redis unavailable).
 */
export async function POST(req: NextRequest) {
  const { error } = await guardPlatformApi('knowledge.admin');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const assetId = body.assetId as string | undefined;
  if (!assetId) {
    return NextResponse.json({ error: 'assetId required' }, { status: 400 });
  }

  try {
    await knowledgeEngineQueue.add(
      'analyze',
      { assetId },
      { jobId: `ke-analyze-${assetId}-${Date.now()}` }
    );
    return NextResponse.json({ queued: true, assetId });
  } catch {
    await KnowledgeAnalysisService.analyzeAsset(assetId);
    return NextResponse.json({ queued: false, processed: true, assetId });
  }
}
