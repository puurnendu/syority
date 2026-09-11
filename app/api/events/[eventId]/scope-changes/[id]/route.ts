/**
 * M8.11 — Scope Change Detail & Lifecycle API
 * GET   /api/events/[eventId]/scope-changes/[id] — Get scope change
 * PATCH /api/events/[eventId]/scope-changes/[id] — Update / submit / approve / reject / apply / analyze
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScopeChangeProposalService } from '@/core/scope-change/ScopeChangeProposalService';
import { ScopeChangeImpactService } from '@/core/scope-change/ScopeChangeImpactService';
import { ScopeChangeApplicationService } from '@/core/scope-change/ScopeChangeApplicationService';
import { scopeChangeErrorBody } from '@/core/scope-change/ScopeChangeOwnership';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id, eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const data = await ScopeChangeProposalService.getById(id, orgId, eventId);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id, eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    let data;

    switch (body.action) {
      case 'analyze':
        data = await ScopeChangeImpactService.analyze(id, orgId, eventId);
        break;

      case 'submit':
        data = await ScopeChangeProposalService.submit(id, orgId, session.user.id, eventId);
        break;

      case 'approve':
        data = await ScopeChangeProposalService.approve(
          id, orgId, session.user.id, body.notes, eventId
        );
        break;

      case 'reject':
        data = await ScopeChangeProposalService.reject(
          id, orgId, session.user.id, body.notes ?? 'Rejected', eventId
        );
        break;

      case 'apply':
        data = await ScopeChangeApplicationService.apply(id, orgId, session.user.id, eventId);
        break;

      default:
        data = await ScopeChangeProposalService.update(id, orgId, body, eventId);
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});
