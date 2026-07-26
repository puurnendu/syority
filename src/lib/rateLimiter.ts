import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// In-memory rate limiter
const limiters = {
  api:    new RateLimiterMemory({ points: 100, duration: 60 }),   // 100 req/min
  ai:     new RateLimiterMemory({ points: 20,  duration: 60 }),   // 20 AI calls/min
  upload: new RateLimiterMemory({ points: 10,  duration: 60 }),   // 10 uploads/min
  auth:   new RateLimiterMemory({ points: 10,  duration: 300 }),  // 10 attempts/5 min
};

export type RateLimitTier = keyof typeof limiters;

/**
 * Check if the request is within rate limits.
 * Returns { allowed: boolean, resetAt: number, remaining: number }
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'api'
) {
  const limiter = limiters[tier];
  try {
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
      resetAt: Date.now() + res.msBeforeNext,
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
