/**
 * M7.6F — Recommendation Actions API
 *
 * GET    /api/bre/recommendations/[id] — Get single recommendation with logs
 * PATCH  /api/bre/recommendations/[id] — Accept, reject, or defer
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { recommendationEngine } from '@/core/bre/RecommendationEngine';
import { apiSuccess, apiError, apiValidationError } from '@/lib/apiResponse';
import { validateBody } from '@/lib/validate';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['accept', 'reject', 'defer']),
  reason: z.string().optional(),
  comment: z.string().optional(),
  deferUntil: z.coerce.date().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await guardApi(req, 'bre:recommendations.view');
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const recommendation = await recommendationEngine.getById(id);
  if (!recommendation) return apiError('NOT_FOUND', 'Recommendation not found', 404);

  return apiSuccess(recommendation);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await guardApi(req, 'bre:recommendations.manage');
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const validation = validateBody(actionSchema, body);
  if (!validation.success) return apiValidationError(validation.error);

  const { action, reason, comment, deferUntil } = validation.data;

  try {
    let result;
    switch (action) {
      case 'accept':
        result = await recommendationEngine.accept(id, ctx.userId, comment);
        break;
      case 'reject':
        if (!reason) return apiError('VALIDATION_ERROR', 'Rejection reason is required', 422);
        result = await recommendationEngine.reject(id, ctx.userId, reason);
        break;
      case 'defer':
        if (!deferUntil) return apiError('VALIDATION_ERROR', 'Defer date is required', 422);
        result = await recommendationEngine.defer(id, ctx.userId, deferUntil, comment);
        break;
    }
    return apiSuccess(result);
  } catch (err: any) {
    return apiError('NOT_FOUND', err.message, 404);
  }
}
