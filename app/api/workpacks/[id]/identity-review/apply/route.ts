import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { WorkpackIdentityReviewService } from '@/core/workpack-identity-review/WorkpackIdentityReviewService';
import { reviewActorFromSession, reviewErrorBody } from '@/core/workpack-identity-review/reviewActor';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = String(body.decision || '');

  const edit = await guardApi(decision === 'QUARANTINE' || decision === 'ROLLBACK' ? 'workpacks.approve' : 'workpacks.edit');
  if (edit.error) return edit.error;
  const events = await guardApi('events.view');
  if (events.error) return events.error;
  if (decision === 'ASSIGN' && body.conflict_resolution) {
    const approve = await guardApi('workpacks.approve');
    if (approve.error) return approve.error;
  }

  const actor = reviewActorFromSession(session);
  try {
    const result = await WorkpackIdentityReviewService.apply(actor, id, {
      decision,
      confirm: body.confirm === true,
      eventId: body.eventId ?? null,
      reason: body.reason,
      evidence: body.evidence,
      expected_version: body.expected_version,
      conflict_resolution: body.conflict_resolution === true,
      approver_id: body.approver_id,
      project_id: body.project_id,
      projectId: body.projectId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const mapped = reviewErrorBody(err);
    return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
  }
});
