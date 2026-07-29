import { Redis } from 'ioredis';

// ── Lazy Redis Singleton ────────────────────────────────────────────────────
//
// Redis connection is created on FIRST USE, never at import time.
// This prevents ECONNREFUSED during `next build` or static generation.
//
// BullMQ requires `maxRetriesPerRequest: null` — without it the client will
// throw on connection loss instead of queuing the command for retry.

let _redis: Redis | undefined;
let _lastRedisErrorTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Get (or create) the shared Redis connection.
 * Safe to call at any time — connection is only established on first call.
 */
export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      {
        maxRetriesPerRequest: null,   // required by BullMQ
        enableReadyCheck: false,      // avoids unnecessary ready checks in workers
      }
    );

    _redis.on('error', (err) => {
      const now = Date.now();
      if (now - _lastRedisErrorTime > ERROR_LOG_INTERVAL) {
        console.error('[Redis] Connection error:', err.message);
        _lastRedisErrorTime = now;
      }
    });
  }
  return _redis;
}

/**
 * Backward-compatible lazy export.
 *
 * Existing code does `import { redis } from '@/lib/redis'` — this Proxy
 * defers the actual Redis connection to the first property access at
 * runtime, matching the same pattern used by `prisma.ts`.
 *
 * No consumer changes required.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_, prop: string | symbol) {
    return (getRedis() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
