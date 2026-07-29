import { NextResponse } from 'next/server';

/**
 * GET /api/system/readiness — Operational readiness probe
 *
 * Verifies that all critical infrastructure is ready to serve requests:
 * - Database reachable
 * - Redis reachable
 * - Required env vars present
 * - AI configuration valid
 * - Storage accessible
 *
 * Returns:
 *   200 — Ready to serve traffic
 *   503 — Not ready (include which checks failed)
 *
 * Used by load balancers and orchestrators (Docker, K8s) to gate traffic.
 */
export async function GET() {
  const checks: Record<string, boolean> = {};
  let isReady = true;

  // ── Database ──────────────────────────────────────────────────────────────
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = true;
  } catch {
    checks.database = false;
    isReady = false;
  }

  // ── Redis ─────────────────────────────────────────────────────────────────
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    checks.redis = pong === 'PONG';
    if (!checks.redis) isReady = false;
  } catch {
    checks.redis = false;
    // Redis unavailable degrades but doesn't block readiness
    // (app can operate without queues in degraded mode)
  }

  // ── Required Environment Variables ────────────────────────────────────────
  checks.env_database_url = !!process.env.DATABASE_URL?.trim();
  checks.env_nextauth_secret = !!process.env.NEXTAUTH_SECRET?.trim();
  checks.env_encryption_key = !!process.env.ENCRYPTION_KEY?.trim();

  if (!checks.env_database_url || !checks.env_nextauth_secret || !checks.env_encryption_key) {
    isReady = false;
  }

  // ── AI Configuration ─────────────────────────────────────────────────────
  const hasVertexAi = !!(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION);
  const hasOpenAi = !!process.env.OPENAI_API_KEY?.trim();
  checks.ai_configured = hasVertexAi || hasOpenAi;
  // AI not being configured doesn't block readiness — app still functions

  // ── Storage ───────────────────────────────────────────────────────────────
  const storageProvider = process.env.STORAGE_PROVIDER || 'local';
  if (storageProvider === 's3') {
    checks.storage = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
  } else {
    checks.storage = true; // Local storage always available
  }
  if (!checks.storage) isReady = false;

  return NextResponse.json(
    {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: isReady ? 200 : 503 }
  );
}
