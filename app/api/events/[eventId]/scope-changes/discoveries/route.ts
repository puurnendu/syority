/**
 * M8.11 — Discovery Work API
 * GET  /api/events/[eventId]/scope-changes/discoveries — List discoveries
 * POST /api/events/[eventId]/scope-changes/discoveries — Create discovery
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DiscoveryWorkService } from '@/core/scope-change/DiscoveryWorkService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as any;
  const priority = url.searchParams.get('priority') as any;
  const discovery_type = url.searchParams.get('discovery_type') as any;

  try {
    const data = await DiscoveryWorkService.listByEvent(eventId, orgId, {
      status, priority, discovery_type,
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /scope-changes/discoveries] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const data = await DiscoveryWorkService.create({
      organization_id: orgId,
      event_id: eventId,
      title: body.title,
      description: body.description,
      discovery_type: body.discovery_type,
      source: body.source,
      location: body.location,
      asset_id: body.asset_id,
      discipline: body.discipline,
      priority: body.priority,
      estimated_hours: body.estimated_hours,
      estimated_cost: body.estimated_cost,
      discovered_by: session.user.id,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /scope-changes/discoveries] Error:', err);
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});
