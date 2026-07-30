/**
 * M7.6F — Kubernetes Readiness Probe
 *
 * GET /api/health/ready
 *
 * Returns 200 if the application can serve traffic:
 *  - Database is connectable
 *  - Redis is connectable
 *
 * Returns 503 if any critical dependency is unreachable.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Both must succeed for readiness
    const [dbResult, redisResult] = await Promise.allSettled([
      prisma.$queryRawUnsafe('SELECT 1'),
      import('@/lib/redis').then(({ getRedis }) => getRedis().ping()),
    ]);

    const dbReady = dbResult.status === 'fulfilled';
    const redisReady = redisResult.status === 'fulfilled';

    if (dbReady && redisReady) {
      return NextResponse.json({ ready: true }, { status: 200 });
    }

    return NextResponse.json(
      {
        ready: false,
        database: dbReady ? 'up' : 'down',
        redis: redisReady ? 'up' : 'down',
      },
      { status: 503 },
    );
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}
