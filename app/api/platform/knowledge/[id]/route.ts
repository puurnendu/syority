import { NextRequest, NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { KnowledgeReviewService } from '@/core/knowledge-engine/KnowledgeReviewService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardPlatformApi('knowledge.view');
  if (error) return error;

  const { id } = await params;
  const asset = await KnowledgeReviewService.get(id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(asset);
}
