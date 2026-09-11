import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScheduleChangeControlService } from '@/core/resources/ScheduleChangeControlService';

/**
 * GET /api/events/[eventId]/schedule/change-requests/[crId]
 * Get a single change request.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { crId } = await params;
  const orgId = session.user.organization_id;

  try {
    const result = await ScheduleChangeControlService.getChangeRequest(crId, orgId);
    if (!result) {
      return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
    }
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[GET /schedule/change-requests/[id]] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

/**
 * PATCH /api/events/[eventId]/schedule/change-requests/[crId]
 * Review (approve/reject) or Apply a change request.
 *
 * Body: { action: 'approve'|'reject'|'apply', review_notes?: string }
 */
export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { crId } = await params;
  const orgId = session.user.organization_id;

  try {
    const { action, review_notes } = await req.json();

    if (action === 'approve' || action === 'reject') {
      await ScheduleChangeControlService.reviewChangeRequest(crId, orgId, {
        action,
        reviewed_by: session.user.id,
        review_notes,
      });
      return NextResponse.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' });
    }

    if (action === 'apply') {
      const result = await ScheduleChangeControlService.applyChangeRequest(crId, orgId, session.user.id);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: 'Invalid action. Use: approve, reject, or apply' }, { status: 400 });
  } catch (err: any) {
    console.error('[PATCH /schedule/change-requests/[id]] Error:', err);
    const status = err.message.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});
