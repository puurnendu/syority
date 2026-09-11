/**
 * M8.11 — Discovery Work Detail API
 * GET   /api/events/[eventId]/scope-changes/discoveries/[id] — Get discovery
 * PATCH /api/events/[eventId]/scope-changes/discoveries/[id] — Update/Assess/Reject
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DiscoveryWorkService } from '@/core/scope-change/DiscoveryWorkService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id } = await params;
  const orgId = session.user.organization_id;

  try {
    const data = await DiscoveryWorkService.getById(id, orgId);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    let data;

    if (body.action === 'assess') {
      data = await DiscoveryWorkService.assess(id, orgId, {
        assessed_by: session.user.id,
        assessment_notes: body.assessment_notes ?? '',
        priority: body.priority,
        estimated_hours: body.estimated_hours,
        estimated_cost: body.estimated_cost,
      });
    } else if (body.action === 'reject') {
      data = await DiscoveryWorkService.reject(
        id, orgId, session.user.id, body.notes ?? 'Rejected'
      );
    } else {
      // Regular update
      data = await DiscoveryWorkService.update(id, orgId, body);
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});
