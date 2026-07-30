/**
 * M7.6E — KPI API
 *
 * CRUD + evaluate for KPI definitions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { KPIEngine } from '@/core/bre/KPIEngine';
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
      const kpi = await KPIEngine.getById(id);
      return kpi ? NextResponse.json({ kpi }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // List built-in KPI templates
    if (url.searchParams.get('action') === 'builtins') {
      return NextResponse.json({ builtins: KPIEngine.getBuiltInKPIs() });
    }

    const kpis = await KPIEngine.list(session.user.organizationId, {
      category: url.searchParams.get('category') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });

    return NextResponse.json({ kpis });
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

    // Activate a KPI
    if (action === 'activate') {
      const kpi = await KPIEngine.activate(body.id, session.user.id);
      return NextResponse.json({ kpi });
    }

    // Evaluate a KPI
    if (action === 'evaluate') {
      const result = await KPIEngine.evaluate(
        body.id,
        { organizationId: session.user.organizationId },
        body.params ?? {},
      );
      return NextResponse.json(result);
    }

    // Load all active KPIs into ProviderRegistry
    if (action === 'load') {
      const count = await KPIEngine.loadActiveKPIs(session.user.organizationId);
      return NextResponse.json({ loaded: count });
    }

    // Create KPI
    const kpi = await KPIEngine.create({
      organizationId: session.user.organizationId,
      slug: body.slug,
      name: body.name,
      description: body.description,
      category: body.category,
      icon: body.icon,
      formulaId: body.formulaId,
      thresholdGreen: body.thresholdGreen,
      thresholdAmber: body.thresholdAmber,
      thresholdRed: body.thresholdRed,
      invertThresholds: body.invertThresholds,
      targetValue: body.targetValue,
      displayFormat: body.displayFormat,
      trendDirection: body.trendDirection,
      createdBy: session.user.id,
    });

    return NextResponse.json({ kpi }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
