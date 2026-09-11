/**
 * M7.6F — Enhanced Health Check API
 *
 * Returns component-level health status:
 *  - database (PostgreSQL via Prisma)
 *  - redis
 *  - application
 *
 * GET /api/health → overall health with component breakdown
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

export async function GET() {
  const start = Date.now();
  const components: Record<string, ComponentHealth> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    components.database = {
      status: 'up',
      latencyMs: Date.now() - dbStart,
    };
  } catch (err: any) {
    components.database = {
      status: 'down',
      message: err.message?.substring(0, 100),
    };
  }

  // 2. Redis check (with timeout to prevent hanging when Redis is down)
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const redisStart = Date.now();
    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout (3s)')), 3000)
      ),
    ]);
    components.redis = {
      status: pong === 'PONG' ? 'up' : 'degraded',
      latencyMs: Date.now() - redisStart,
    };
  } catch (err: any) {
    components.redis = {
      status: 'down',
      message: err.message?.substring(0, 100),
    };
  }

  // 3. Application
  components.application = {
    status: 'up',
    latencyMs: Date.now() - start,
  };

  // Overall status
  const allUp = Object.values(components).every((c) => c.status === 'up');
  const anyDown = Object.values(components).some((c) => c.status === 'down');
  const overallStatus = anyDown ? 'down' : allUp ? 'up' : 'degraded';

  const httpStatus = overallStatus === 'down' ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      components,
    },
    { status: httpStatus },
  );
}
