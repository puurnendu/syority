/**
 * M7.6G — Admin Feedback API
 *
 * GET   /api/admin/feedback — All feedback (platform admin)
 * PATCH /api/admin/feedback — Update status/assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { feedbackService, type FeedbackType, type FeedbackStatus, type FeedbackSeverity } from '@/core/platform/FeedbackService';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';

async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any).role ?? '';
  if (!hasPermission(role, 'nav.admin')) return null;
  return session.user;
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'closed', 'wont_fix']).optional(),
  assigned_to: z.string().uuid().optional(),
  resolution_notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const result = await feedbackService.list({
    type: (searchParams.get('type') as FeedbackType) || undefined,
    status: (searchParams.get('status') as FeedbackStatus) || undefined,
    severity: (searchParams.get('severity') as FeedbackSeverity) || undefined,
    page,
    limit,
  });

  const stats = await feedbackService.getStats();

  return NextResponse.json({ ...result, stats });
}

export async function PATCH(req: NextRequest) {
  const user = await requirePlatformAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  }

  const { id, ...updates } = parsed.data;
  const feedback = await feedbackService.updateStatus(id, updates);
  return NextResponse.json({ feedback });
}
