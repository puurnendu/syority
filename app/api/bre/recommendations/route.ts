/**
 * M7.6F — Recommendation API
 *
 * GET  /api/bre/recommendations — List with filters
 * POST /api/bre/recommendations — Generate new recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { recommendationEngine, type RecommendationInput } from '@/core/bre/RecommendationEngine';
import { apiSuccess, apiPaginated, apiError, apiValidationError, parsePagination } from '@/lib/apiResponse';
import { validateBody } from '@/lib/validate';
import { z } from 'zod';

const createSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum([
    'planning', 'safety', 'execution', 'qa_qc', 'inspection',
    'contractor', 'resource', 'material', 'permit', 'critical_path', 'constraint',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  expectedImpact: z.string().optional(),
  sourceType: z.enum(['rule', 'formula', 'kpi', 'ai', 'manual']).default('manual'),
  sourceRuleId: z.string().uuid().optional(),
  sourceFormulaId: z.string().uuid().optional(),
  supportingKpis: z.array(z.object({
    name: z.string(),
    value: z.number(),
    threshold: z.number(),
  })).optional(),
  alternatives: z.array(z.object({
    title: z.string(),
    description: z.string(),
    confidence: z.number(),
  })).optional(),
  targetEntityType: z.string().optional(),
  targetEntityId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
  showInDashboard: z.boolean().optional(),
  showInTvMode: z.boolean().optional(),
  showInMeeting: z.boolean().optional(),
  showInReports: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guardApi(req, 'bre:recommendations.view');
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);

  const result = await recommendationEngine.list({
    organizationId: ctx.organizationId,
    status: searchParams.get('status') as any || undefined,
    category: searchParams.get('category') as any || undefined,
    priority: searchParams.get('priority') as any || undefined,
    eventId: searchParams.get('eventId') || undefined,
    showInDashboard: searchParams.get('showInDashboard') === 'true' ? true : undefined,
    showInTvMode: searchParams.get('showInTvMode') === 'true' ? true : undefined,
    showInMeeting: searchParams.get('showInMeeting') === 'true' ? true : undefined,
    page,
    limit,
  });

  return apiPaginated(result.items, result.total, result.page, result.limit);
}

export async function POST(req: NextRequest) {
  const ctx = await guardApi(req, 'bre:recommendations.manage');
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const validation = validateBody(createSchema, body);
  if (!validation.success) return apiValidationError(validation.error);

  const input: RecommendationInput = {
    ...validation.data,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  };

  const recommendation = await recommendationEngine.generate(input);
  return apiSuccess(recommendation, 201);
}
