/**
 * Shared API Error Handler — Syority Platform
 *
 * Maps thrown errors to safe NextResponse JSON objects.
 * Never leaks stack traces. Always returns consistent shape.
 *
 * Usage in API routes:
 *   import { handleApiError } from '@/lib/apiErrorHandler';
 *
 *   export async function POST(req: NextRequest) {
 *     try {
 *       // ... route logic ...
 *     } catch (error) {
 *       return handleApiError(error);
 *     }
 *   }
 */

import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Convert any thrown error into a safe NextResponse.
 *
 * - AppError subtypes → use their statusCode and code
 * - Unknown errors → 500 with generic message (stack logged server-side)
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Known application errors — safe to return message to client
  if (error instanceof AppError) {
    logger.warn('API', error.message, {
      code: error.code,
      statusCode: error.statusCode,
      ...(error.details ?? {}),
    });

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  // Unknown / unexpected errors — never leak internals
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error('API', 'Unhandled error', { message, stack });

  return NextResponse.json(
    {
      error: 'An unexpected error occurred. Please try again or contact support.',
      code: 'UNEXPECTED_ERROR',
    },
    { status: 500 }
  );
}
