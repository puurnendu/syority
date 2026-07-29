/**
 * Standardized Runtime Error Classes — Syority Platform
 *
 * All API routes and services should throw these typed errors
 * instead of raw Error objects. The apiErrorHandler maps them
 * to safe HTTP responses without leaking stack traces.
 *
 * Usage:
 *   throw new ValidationError('Email is required');
 *   throw new PermissionError('Cannot delete workpacks');
 *   throw new BusinessError('Workpack is already approved');
 *   throw new InfrastructureError('Redis connection failed');
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND'
  | 'BUSINESS_ERROR'
  | 'INFRASTRUCTURE_ERROR'
  | 'UNEXPECTED_ERROR';

/**
 * Base application error with a typed code and HTTP status.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 400 — Bad input, missing fields, invalid format.
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * 401 — Not authenticated.
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

/**
 * 403 — Authenticated but not authorized.
 */
export class PermissionError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 'PERMISSION_ERROR', 403);
  }
}

/**
 * 404 — Resource not found.
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    const msg = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(msg, 'NOT_FOUND', 404);
  }
}

/**
 * 422 — Business rule violation (e.g. workpack already approved).
 */
export class BusinessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BUSINESS_ERROR', 422, details);
  }
}

/**
 * 503 — Infrastructure failure (Redis, DB, AI unavailable).
 */
export class InfrastructureError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INFRASTRUCTURE_ERROR', 503, details);
  }
}
