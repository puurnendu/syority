import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// In-memory rate limiter
const limiters = {
  api:     new RateLimiterMemory({ points: 100, duration: 60 }),   // 100 req/min
  ai:      new RateLimiterMemory({ points: 20,  duration: 60 }),   // 20 AI calls/min
  upload:  new RateLimiterMemory({ points: 10,  duration: 60 }),   // 10 uploads/min
  auth:    new RateLimiterMemory({ points: 10,  duration: 300 }),  // 10 attempts/5 min
  webhook: new RateLimiterMemory({ points: 60,  duration: 60 }),   // 60 webhook calls/min
};

export type RateLimitTier = keyof typeof limiters;

/** Per-route limits used by Voice (30/min) and Mobile (60/min). */
export type RateLimitCustomOptions = {
  maxRequests: number;
  windowMs: number;
};

const customLimiters = new Map<string, RateLimiterMemory>();

function resolveLimiter(tier: RateLimitTier | RateLimitCustomOptions): RateLimiterMemory | undefined {
  if (typeof tier === 'string') {
    return limiters[tier];
  }
  const durationSec = Math.max(1, Math.ceil(tier.windowMs / 1000));
  const key = `${tier.maxRequests}:${durationSec}`;
  let limiter = customLimiters.get(key);
  if (!limiter) {
    limiter = new RateLimiterMemory({ points: tier.maxRequests, duration: durationSec });
    customLimiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Check if the request is within rate limits.
 * Accepts a named tier or { maxRequests, windowMs } (Voice/Mobile live routes).
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier | RateLimitCustomOptions = 'api'
) {
  const limiter = resolveLimiter(tier);
  try {
    if (!limiter) {
      throw new Error('Unknown rate limit configuration');
    }
    const res = await limiter.consume(identifier);
    return {
      allowed: true,
      remaining: res.remainingPoints,
      resetAt: Date.now() + res.msBeforeNext,
    };
  } catch (res: any) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + (typeof res?.msBeforeNext === 'number' ? res.msBeforeNext : 60_000),
    };
  }
}

/**
 * Standard 429 response.
 */
export function rateLimitResponse(resetAt: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please wait before trying again.' },
    {
      status: 429,
      headers: {
        'Retry-After':        String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Reset':  String(resetAt),
      },
    }
  );
}
