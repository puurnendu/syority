/**
 * M7.6F — Recommendation Statistics API
 *
 * GET /api/bre/recommendations/stats — Dashboard widget data
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { recommendationEngine } from '@/core/bre/RecommendationEngine';
import { apiSuccess } from '@/lib/apiResponse';

export async function GET(req: NextRequest) {
  const ctx = await guardApi(req, 'bre:recommendations.view');
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId') || undefined;

  const stats = await recommendationEngine.getStats(ctx.organizationId, eventId);
  return apiSuccess(stats);
}
