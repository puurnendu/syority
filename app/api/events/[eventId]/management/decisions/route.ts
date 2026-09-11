/**
 * GET  /api/events/[eventId]/management/decisions
 * POST /api/events/[eventId]/management/decisions
 *
 * Append-only management decision journal. Never EWS / Activity mutation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DecisionIntelligenceService } from '@/core/m15/DecisionIntelligenceService';
import { DecisionContextError } from '@/core/m15/types';
import type { ManagementDecisionValue } from '@/core/m15/types';

const DECISIONS = new Set<ManagementDecisionValue>([
  'ACCEPT',
  'REJECT',
  'DEFER',
  'REQUEST_MORE_INFORMATION',
]);

export const GET = withTenantGuard(async (_req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  const { eventId } = await params;
  const orgId = session.user.organization_id;
  try {
    const data = await DecisionIntelligenceService.listManagementDecisions(orgId, eventId);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    if (err instanceof DecisionContextError) {
      return NextResponse.json({ error: err.message }, { status: err.code === 'EVENT_REQUIRED' ? 400 : 404 });
    }
    return NextResponse.json({ error: 'Failed to load decisions' }, { status: 500 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision as ManagementDecisionValue | undefined;
  if (!body.recommendationId || !decision || !DECISIONS.has(decision)) {
    return NextResponse.json(
      { error: 'recommendationId and a valid decision are required' },
      { status: 400 }
    );
  }
  try {
    const data = await DecisionIntelligenceService.recordManagementDecision(orgId, eventId, userId, {
      recommendationId: body.recommendationId,
      decision,
      rationale: body.rationale,
      sourceChannel: 'web',
      relatedScenarioId: body.relatedScenarioId,
    });
    // body.authorizesExecution is ignored; journal always authorizesExecution=false.
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof DecisionContextError) {
      const http =
        err.code === 'HUMAN_REQUIRED' || err.code === 'INVALID_DECISION'
          ? 400
          : err.code === 'EVENT_REQUIRED'
            ? 400
            : 404;
      return NextResponse.json({ error: err.message }, { status: http });
    }
    console.error('[POST management/decisions]', err);
    return NextResponse.json({ error: 'Failed to record decision' }, { status: 500 });
  }
});
