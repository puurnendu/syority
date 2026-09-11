/**
 * M8.11 — Scope Change Items API
 * POST   /api/events/[eventId]/scope-changes/[id]/items — Add item
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScopeChangeProposalService } from '@/core/scope-change/ScopeChangeProposalService';
import { scopeChangeErrorBody } from '@/core/scope-change/ScopeChangeOwnership';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id, eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const data = await ScopeChangeProposalService.addItem(id, orgId, body, {
      eventId,
      userId: session.user.id,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});
