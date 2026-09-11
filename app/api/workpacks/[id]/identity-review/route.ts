import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { WorkpackIdentityReviewService } from '@/core/workpack-identity-review/WorkpackIdentityReviewService';
import { reviewActorFromSession, reviewErrorBody } from '@/core/workpack-identity-review/reviewActor';

export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const view = await guardApi('workpacks.view');
  if (view.error) return view.error;
  const events = await guardApi('events.view');
  if (events.error) return events.error;

  const { id } = await params;
  const actor = reviewActorFromSession(session);
  try {
    const [detail, orgEvents] = await Promise.all([
      WorkpackIdentityReviewService.getDetail(actor, id),
      WorkpackIdentityReviewService.listOrgEvents(actor),
    ]);
    return NextResponse.json({ data: { ...detail, org_events: orgEvents } });
  } catch (err) {
    const mapped = reviewErrorBody(err);
    return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
  }
});
