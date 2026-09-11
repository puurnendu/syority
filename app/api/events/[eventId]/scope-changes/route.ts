/**
 * M8.11 — Scope Change API
 * GET  /api/events/[eventId]/scope-changes — List scope changes
 * POST /api/events/[eventId]/scope-changes — Create scope change
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScopeChangeProposalService } from '@/core/scope-change/ScopeChangeProposalService';
import { scopeChangeErrorBody } from '@/core/scope-change/ScopeChangeOwnership';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as any;
  const change_category = url.searchParams.get('change_category') as any;

  try {
    const data = await ScopeChangeProposalService.listByEvent(eventId, orgId, {
      status, change_category,
    });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const data = await ScopeChangeProposalService.create({
      organization_id: orgId,
      event_id: eventId,
      discovery_id: body.discovery_id,
      title: body.title,
      description: body.description,
      change_category: body.change_category,
      justification: body.justification,
      priority: body.priority,
      discipline: body.discipline,
      created_by: session.user.id,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});
