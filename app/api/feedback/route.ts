/**
 * M7.6G — User Feedback API
 *
 * GET  /api/feedback — User's own feedback
 * POST /api/feedback — Submit feedback (any authenticated user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { feedbackService } from '@/core/platform/FeedbackService';
import { z } from 'zod';

const submitSchema = z.object({
  type: z.enum(['bug', 'improvement', 'feature_request', 'question', 'general']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  route: z.string().optional(),
  currentModule: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  resolution: z.string().optional(),
  screenshotUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  const result = await feedbackService.list({
    userId: user.id,
    organizationId: user.organizationId,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  // Read version from package.json at runtime
  let appVersion = '1.0.0';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appVersion = require('@/../package.json').version;
  } catch { /* ignore */ }

  const feedback = await feedbackService.submit({
    organizationId: user.organizationId,
    userId: user.id,
    ...parsed.data,
    appVersion,
    gitCommit: process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA,
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
