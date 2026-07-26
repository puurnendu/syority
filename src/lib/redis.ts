import { Redis } from 'ioredis';

/**
 * Shared ioredis connection for BullMQ.
 *
 * BullMQ requires `maxRetriesPerRequest: null` — without it the client will
 * throw on connection loss instead of queuing the command for retry.
 */
export const redis = new Redis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,    // avoids unnecessary ready checks in workers
  }
);

let lastRedisErrorTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // 5 minutes

redis.on('error', (err) => {
    const now = Date.now();
    if (now - lastRedisErrorTime > ERROR_LOG_INTERVAL) {
        console.error('[Redis] Connection error:', err.message);
        lastRedisErrorTime = now;
    }
});
