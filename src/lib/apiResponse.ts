/**
 * M7.6F — Standard API Response Envelope
 *
 * All API routes should use these helpers for consistent response format.
 *
 * Success: { data: T, meta?: PaginationMeta }
 * Error:   { error: { code: string, message: string, details?: unknown } }
 *
 * Usage:
 *   import { apiSuccess, apiPaginated, apiError, apiValidationError } from '@/lib/apiResponse';
 *
 *   return apiSuccess(data);
 *   return apiPaginated(items, total, page, limit);
 *   return apiError('NOT_FOUND', 'Resource not found', 404);
 *   return apiValidationError(zodError);
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Standard success response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ data }, { status });
}

/**
 * Paginated success response.
 */
export function apiPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  status = 200,
): NextResponse<ApiSuccessResponse<T[]>> {
  const totalPages = Math.ceil(total / limit);
  return NextResponse.json(
    {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
    { status },
  );
}

/**
 * Standard error response.
 */
export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

/**
 * Validation error response from Zod.
 */
export function apiValidationError(error: ZodError): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    },
    { status: 422 },
  );
}

/**
 * Parse pagination parameters from URL search params.
 * Provides safe defaults and bounds.
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
