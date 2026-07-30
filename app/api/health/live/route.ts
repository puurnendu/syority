/**
 * M7.6F — Kubernetes Liveness Probe
 *
 * GET /api/health/live
 *
 * Returns 200 if the Node.js process is alive and the event loop is responsive.
 * Does NOT check external dependencies — that's the readiness probe's job.
 *
 * If this endpoint fails, the container should be restarted.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      alive: true,
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
