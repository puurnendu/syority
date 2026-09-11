/**
 * GET /api/m13/control-tower/summary
 * 
 * M13 Turnaround Control Tower Summary API.
 * 
 * Returns the Control Tower dashboard summary payload including overall progress metrics,
 * critical path/lateness counts, and predictive exceptions based on SPI & Float.
 * 
 * Security: Enforces tenant isolation using the authenticated user's organization_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as { id: string; organization_id: string };
  const url = new URL(req.url);
  const eventId = url.searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json(
      { error: 'eventId query parameter is required' },
      { status: 400 }
    );
  }

  // ── Execute ───────────────────────────────────────────────────────────
  try {
    const result = await ControlTowerQueryService.getSummary(user.organization_id, eventId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[m13/control-tower] Query execution error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
