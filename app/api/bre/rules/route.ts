/**
 * M7.6E — Rules API
 *
 * CRUD + simulate + evaluate for business rules.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RulesEngine } from '@/core/bre/RulesEngine';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (id) {
      const rule = await RulesEngine.getById(id);
      return rule
        ? NextResponse.json({ rule })
        : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rules = await RulesEngine.list(session.user.organizationId, {
      category: url.searchParams.get('category') ?? undefined,
      severity: url.searchParams.get('severity') ?? undefined,
      isEnabled: url.searchParams.get('enabled') === 'true' ? true : url.searchParams.get('enabled') === 'false' ? false : undefined,
      search: url.searchParams.get('search') ?? undefined,
    });

    return NextResponse.json({ rules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    // Simulate a rule condition
    if (action === 'simulate') {
      const result = await RulesEngine.simulate(
        body.conditionExpression,
        { organizationId: session.user.organizationId },
        body.params ?? {},
      );
      return NextResponse.json(result);
    }

    // Evaluate a single rule
    if (action === 'evaluate') {
      const result = await RulesEngine.evaluateRule(
        body.id,
        { organizationId: session.user.organizationId },
        body.params ?? {},
      );
      return NextResponse.json(result);
    }

    // Evaluate all scheduled rules
    if (action === 'evaluate_all') {
      const results = await RulesEngine.evaluateScheduledRules(
        session.user.organizationId,
        body.params ?? {},
      );
      return NextResponse.json({ results, total: results.length, passed: results.filter((r) => r.passed).length });
    }

    // Enable/disable
    if (action === 'set_enabled') {
      await RulesEngine.setEnabled(body.id, body.enabled, session.user.id);
      return NextResponse.json({ success: true });
    }

    // Create rule
    const rule = await RulesEngine.create({
      organizationId: session.user.organizationId,
      slug: body.slug,
      name: body.name,
      description: body.description,
      category: body.category,
      conditionExpression: body.conditionExpression,
      conditionVariables: body.conditionVariables,
      evaluationMode: body.evaluationMode,
      evaluationCron: body.evaluationCron,
      eventTypes: body.eventTypes,
      scopeSiteId: body.scopeSiteId,
      scopeUnitId: body.scopeUnitId,
      scopeArea: body.scopeArea,
      scopeEquipment: body.scopeEquipment,
      scopeWorkpackId: body.scopeWorkpackId,
      scopeShift: body.scopeShift,
      priority: body.priority,
      severity: body.severity,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : undefined,
      escalationChainId: body.escalationChainId,
      createdBy: session.user.id,
      actions: body.actions,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
