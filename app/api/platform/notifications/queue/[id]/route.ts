/**
 * POST /api/platform/notifications/queue/[id]/cancel — Cancel queued item
 * POST /api/platform/notifications/queue/[id]/retry  — Retry failed item
 *
 * These are separate routes but this file handles the shared [id] segment.
 * Specific actions are routed via /cancel and /retry sub-routes.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Use /cancel or /retry' }, { status: 400 });
}
