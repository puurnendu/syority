import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { KnowledgeReviewService } from '@/core/knowledge-engine/KnowledgeReviewService';

export async function GET(req: NextRequest) {
  const { error } = await guardPlatformApi('knowledge.view');
  if (error) return error;

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const category = req.nextUrl.searchParams.get('category') || undefined;
  const [items, stats] = await Promise.all([
    KnowledgeReviewService.list(status, category),
    KnowledgeReviewService.stats(),
  ]);

  return NextResponse.json({ items, stats });
}
