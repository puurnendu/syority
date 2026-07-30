/**
 * M7.6E — Escalation API
 *
 * CRUD for escalation chains + manual escalation processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { EscalationEngine } from '@/core/bre/EscalationEngine';
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
      const chain = await EscalationEngine.getChain(id);
      return chain ? NextResponse.json({ chain }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // List default chain templates
    if (url.searchParams.get('action') === 'defaults') {
      return NextResponse.json({ defaults: EscalationEngine.getDefaultChains() });
    }

    const chains = await EscalationEngine.listChains(session.user.organizationId);
    return NextResponse.json({ chains });
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

    // Process pending escalations
    if (action === 'process') {
      const count = await EscalationEngine.processEscalations(session.user.organizationId);
      return NextResponse.json({ escalated: count });
    }

    // Create chain
    const chain = await EscalationEngine.createChain({
      organizationId: session.user.organizationId,
      name: body.name,
      description: body.description,
      category: body.category,
      respectBusinessHours: body.respectBusinessHours,
      businessHoursStart: body.businessHoursStart,
      businessHoursEnd: body.businessHoursEnd,
      timezone: body.timezone,
      holidayCalendar: body.holidayCalendar,
      createdBy: session.user.id,
      levels: body.levels,
    });

    return NextResponse.json({ chain }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
