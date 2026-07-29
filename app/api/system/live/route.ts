import { NextResponse } from 'next/server';

/**
 * GET /api/system/live — Liveness probe
 *
 * Ultra-lightweight check that verifies the Node.js process is alive
 * and the application has booted. No database, Redis, or external I/O.
 *
 * Used by orchestrators (Docker HEALTHCHECK, K8s livenessProbe) to
 * detect hung processes and trigger restarts.
 */
export async function GET() {
  return NextResponse.json({
    status: 'alive',
    uptime_seconds: Math.floor(process.uptime()),
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
}
