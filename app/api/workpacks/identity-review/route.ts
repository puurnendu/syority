import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { WorkpackIdentityReviewService } from '@/core/workpack-identity-review/WorkpackIdentityReviewService';
import { reviewActorFromSession, reviewErrorBody } from '@/core/workpack-identity-review/reviewActor';

export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const view = await guardApi('workpacks.view');
  if (view.error) return view.error;
  const events = await guardApi('events.view');
  if (events.error) return events.error;

  const actor = reviewActorFromSession(session);
  const url = new URL(req.url);
  try {
    const data = await WorkpackIdentityReviewService.listQueue(actor, {
      classification: url.searchParams.get('classification') ?? undefined,
      review_state: url.searchParams.get('review_state') ?? undefined,
      site_id: url.searchParams.get('site_id') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      work_type: url.searchParams.get('work_type') ?? undefined,
      priority: url.searchParams.get('priority') ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const mapped = reviewErrorBody(err);
    return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
  }
});
