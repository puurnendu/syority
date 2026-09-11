/**
 * POST /api/events/[eventId]/management/what-if
 * Hypothetical only. Org from session, event from path. Never EWS / leveling apply.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DecisionIntelligenceService } from '@/core/m15/DecisionIntelligenceService';
import { DecisionContextError } from '@/core/m15/types';
import type { WhatIfKind } from '@/core/m15/types';

const KINDS = new Set<WhatIfKind>([
  'DURATION_SLIP',
  'DURATION_CHANGE',
  'DELAYED_START',
  'RESOURCE_LEVELING_SIMULATION',
  'ADDITIONAL_CREWS',
  'CONSTRAINT_REMOVAL',
  'SCOPE_CHANGE',
]);

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as WhatIfKind | undefined;

  if (!kind || !KINDS.has(kind)) {
    return NextResponse.json({ error: 'kind is required and must be a known what-if kind' }, { status: 400 });
  }

  try {
    const data = await DecisionIntelligenceService.runWhatIf(orgId, eventId, userId, {
      kind,
      activityId: body.activityId,
      slipHours: body.slipHours,
      durationHours: body.durationHours,
      delayDays: body.delayDays,
    });
    const status = data.status === 'CALCULATED' ? 201 : 200;
    return NextResponse.json({ data }, { status });
  } catch (err: any) {
    if (err instanceof DecisionContextError) {
      const http = err.code === 'EVENT_REQUIRED' ? 400 : 404;
      return NextResponse.json({ error: err.message }, { status: http });
    }
    console.error('[POST management/what-if]', err);
    return NextResponse.json({ error: err.message || 'Failed to run what-if' }, { status: 400 });
  }
});
