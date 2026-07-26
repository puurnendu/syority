import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const userId = (session.user as any).id;

    const body = await req.json();
    const { name, code, event_type, site_id, planned_start, planned_end, budget_manhours, budget_cost } = body;

    if (!name || !code || !site_id) {
      return NextResponse.json({ error: 'Name, code, and site_id are required' }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        organization_id: orgId,
        site_id,
        name,
        code,
        event_type: event_type || 'turnaround',
        planned_start: planned_start ? new Date(planned_start) : null,
        planned_end: planned_end ? new Date(planned_end) : null,
        budget_manhours: budget_manhours ? parseInt(budget_manhours, 10) : null,
        budget_cost: budget_cost ? parseFloat(budget_cost) : null,
        created_by: userId,
        status: 'planning',
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 });
  }
}
