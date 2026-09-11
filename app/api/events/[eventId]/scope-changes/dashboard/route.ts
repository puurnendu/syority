/**
 * M8.11 — Scope Change Dashboard API
 * GET /api/events/[eventId]/scope-changes/dashboard — Dashboard KPIs
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScopeChangeProposalService } from '@/core/scope-change/ScopeChangeProposalService';
import { DiscoveryWorkService } from '@/core/scope-change/DiscoveryWorkService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const [discoverySummary, scopeChangeSummary] = await Promise.all([
      DiscoveryWorkService.getEventSummary(eventId, orgId),
      ScopeChangeProposalService.getDashboardSummary(eventId, orgId),
    ]);

    return NextResponse.json({
      data: {
        discoveries: discoverySummary,
        scopeChanges: scopeChangeSummary,
      },
    });
  } catch (err: any) {
    console.error('[GET /scope-changes/dashboard] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
