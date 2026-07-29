import { NextResponse } from 'next/server';

/**
 * GET /api/system/health — Comprehensive health check
 *
 * Returns status of all infrastructure components:
 * - Application, Database, Redis, BullMQ, Vertex AI, Storage
 * - Version, Git SHA, Node version, Uptime
 *
 * Used for deployment verification and monitoring dashboards.
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; latency_ms?: number; detail?: string }> = {};

  // ── Application ───────────────────────────────────────────────────────────
  checks.application = { status: 'healthy', detail: 'Running' };

  // ── Database ──────────────────────────────────────────────────────────────
  try {
    const dbStart = Date.now();
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = { status: 'healthy', latency_ms: Date.now() - dbStart };
  } catch (err: any) {
    checks.database = { status: 'unhealthy', detail: err.message };
  }

  // ── Redis ─────────────────────────────────────────────────────────────────
  try {
    const redisStart = Date.now();
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 3000)),
    ]);
    checks.redis = { status: pong === 'PONG' ? 'healthy' : 'degraded', latency_ms: Date.now() - redisStart };
  } catch (err: any) {
    checks.redis = { status: 'unhealthy', detail: err.message };
  }

  // ── BullMQ Queues ─────────────────────────────────────────────────────────
  try {
    const { getScheduleRecalculateQueue, getReportDeliveryQueue, getKnowledgeEngineQueue } = await import('@/lib/queues');
    const queues = [
      { name: 'schedule-recalculate', q: getScheduleRecalculateQueue() },
      { name: 'report-delivery', q: getReportDeliveryQueue() },
      { name: 'knowledge-engine', q: getKnowledgeEngineQueue() },
    ];

    const queueStatuses: Record<string, string> = {};
    for (const { name, q } of queues) {
      try {
        const counts = await q.getJobCounts();
        queueStatuses[name] = `waiting=${counts.waiting ?? 0} active=${counts.active ?? 0} failed=${counts.failed ?? 0}`;
      } catch {
        queueStatuses[name] = 'unreachable';
      }
    }
    const allHealthy = !Object.values(queueStatuses).includes('unreachable');
    checks.bullmq = { status: allHealthy ? 'healthy' : 'degraded', detail: JSON.stringify(queueStatuses) };
  } catch (err: any) {
    checks.bullmq = { status: 'unhealthy', detail: err.message };
  }

  // ── Vertex AI ─────────────────────────────────────────────────────────────
  const hasVertexConfig = !!(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION);
  checks.vertex_ai = {
    status: hasVertexConfig ? 'healthy' : 'degraded',
    detail: hasVertexConfig
      ? `Project=${process.env.GOOGLE_CLOUD_PROJECT}, Location=${process.env.GOOGLE_CLOUD_LOCATION}`
      : 'GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION not configured',
  };

  // ── Storage ───────────────────────────────────────────────────────────────
  const storageProvider = process.env.STORAGE_PROVIDER || 'local';
  checks.storage = {
    status: 'healthy',
    detail: `Provider=${storageProvider}`,
  };

  // ── Version / Meta ────────────────────────────────────────────────────────
  const overallStatus = Object.values(checks).every(c => c.status === 'healthy')
    ? 'healthy'
    : Object.values(checks).some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

  const result = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '0.1.0',
    git_sha: process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development',
    checks,
    response_time_ms: Date.now() - startTime,
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
