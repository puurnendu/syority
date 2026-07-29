import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { ReadinessScoreService } from '@/core/workpack-intelligence';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ scopeId: string }> }) {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  const { scopeId } = await params;

  const results = await ReadinessScoreService.batchComputeReadiness(scopeId);
  return NextResponse.json({ data: results });
}
