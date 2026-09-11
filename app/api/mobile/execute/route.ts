/**
 * POST /api/mobile/execute — Mobile execution endpoint
 *
 * Accepts authenticated execution requests and routes through
 * MobileChannelAdapter → R3 Authorization → EWS.
 *
 * Identity from NextAuth session, NOT from request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { processMobileExecution, getMobileReadiness } from '@/core/m16/channels/MobileChannelAdapter';
import { checkRateLimit } from '@/lib/rateLimiter';
import type { ExecutionAction } from '@/core/execution/ExecutionWriteService';

// ── POST — Execute action ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via NextAuth JWT
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.sub || !token?.organization_id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = token.sub as string;
    const organizationId = token.organization_id as string;
    const userName = (token.name as string) || 'Unknown';

    // 2. Rate limit (60 req/min per user)
    const rateResult = await checkRateLimit(`mobile:${userId}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const { activityId, action, eventId, progress, notes, hold_reason, hold_category, delayDetails, requestId } = body;

    if (!activityId || !action || !eventId) {
      return NextResponse.json(
        { error: 'Missing required fields: activityId, action, eventId' },
        { status: 400 }
      );
    }

    // 4. Validate action is known
    const validActions: ExecutionAction[] = [
      'START', 'UPDATE_PROGRESS', 'COMPLETE', 'HOLD', 'RESUME',
      'RELEASE', 'VERIFY', 'CLOSE', 'REPORT_DELAY',
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    // 5. Process through MobileChannelAdapter
    const result = await processMobileExecution(
      { activityId, action, eventId, progress, notes, hold_reason, hold_category, delayDetails, requestId },
      { userId, userName, organizationId }
    );

    const statusCode = result.status === 'denied' ? 403
      : result.status === 'error' ? 500
      : 200;

    return NextResponse.json(result, { status: statusCode });
  } catch (err: any) {
    console.error('[MobileRoute] Unhandled error:', err.message);
    return NextResponse.json(
      { error: 'Execution failed. Please try again.' },
      { status: 500 }
    );
  }
}

// ── GET — Readiness check ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.sub || !token?.organization_id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const organizationId = token.organization_id as string;
    const activityId = req.nextUrl.searchParams.get('activityId');

    if (!activityId) {
      return NextResponse.json({ error: 'Missing activityId' }, { status: 400 });
    }

    const readiness = await getMobileReadiness(activityId, {
      userId: token.sub as string,
      userName: (token.name as string) || 'Unknown',
      organizationId,
    });

    return NextResponse.json({ success: true, data: readiness });
  } catch (err: any) {
    return NextResponse.json({ error: 'Readiness check failed' }, { status: 500 });
  }
}
