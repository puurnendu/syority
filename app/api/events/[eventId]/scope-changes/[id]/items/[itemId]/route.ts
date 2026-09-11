/**
 * M8.11 — Scope Change Item Detail API
 * PATCH  /api/events/[eventId]/scope-changes/[id]/items/[itemId] — Update item
 * DELETE /api/events/[eventId]/scope-changes/[id]/items/[itemId] — Delete item
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScopeChangeProposalService } from '@/core/scope-change/ScopeChangeProposalService';
import { scopeChangeErrorBody } from '@/core/scope-change/ScopeChangeOwnership';

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { itemId, id, eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const data = await ScopeChangeProposalService.updateItem(itemId, orgId, body, {
      eventId,
      userId: session.user.id,
      scopeChangeId: id,
    });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { itemId, id, eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    await ScopeChangeProposalService.deleteItem(itemId, orgId, {
      eventId,
      userId: session.user.id,
      scopeChangeId: id,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const mapped = scopeChangeErrorBody(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
});
