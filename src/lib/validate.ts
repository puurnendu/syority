/**
 * M7.6F — Zod Request Validation Utility
 *
 * Provides type-safe request body validation for API routes.
 *
 * Usage:
 *   import { validateBody, validateQuery } from '@/lib/validate';
 *   import { z } from 'zod';
 *
 *   const schema = z.object({ name: z.string(), status: z.enum(['active', 'draft']) });
 *
 *   export async function POST(req: NextRequest) {
 *     const result = validateBody(schema, await req.json());
 *     if (!result.success) return apiValidationError(result.error);
 *     const { name, status } = result.data;
 *   }
 */

import { ZodSchema, ZodError, z } from 'zod';

// ── Body Validation ──────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError };

/**
 * Validate a request body against a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery<T>(
  schema: ZodSchema<T>,
  searchParams: URLSearchParams,
): ValidationResult<T> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ── Common Schemas ───────────────────────────────────────────────────────────

/** UUID string validation */
export const uuidSchema = z.string().uuid();

/** Standard pagination query params */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Standard sort query params */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Date range filter */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
