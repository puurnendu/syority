import { AppError, type ErrorCode } from '@/lib/errors';

export type ActivityIdentityCode =
  | 'INVALID_WORKPACK'
  | 'CROSS_TENANT_WORKPACK'
  | 'INVALID_EVENT'
  | 'CROSS_TENANT_EVENT'
  | 'EVENT_MISMATCH'
  | 'INVALID_ASSET'
  | 'CROSS_TENANT_ASSET'
  | 'ASSET_CONFLICT'
  | 'INVALID_DISCIPLINE'
  | 'INVALID_STANDARD_ACTIVITY'
  | 'INVALID_HIERARCHY'
  | 'INVALID_SITE'
  | 'MISSING_REQUIRED_IDENTITY'
  | 'EXECUTION_FIELD_REJECTED';

const CROSS_TENANT_CODES: ReadonlySet<ActivityIdentityCode> = new Set([
  'CROSS_TENANT_WORKPACK',
  'CROSS_TENANT_EVENT',
  'CROSS_TENANT_ASSET',
]);

/**
 * Identity/relationship rejection for Activity creation.
 * Does not replace ControlledValidationError — governed master-data
 * failures from ControlledValueResolver propagate as themselves.
 */
export class ActivityIdentityError extends AppError {
  public readonly identityCode: ActivityIdentityCode;

  constructor(identityCode: ActivityIdentityCode, message: string, details?: Record<string, unknown>) {
    const isCrossTenant = CROSS_TENANT_CODES.has(identityCode);
    const code: ErrorCode = isCrossTenant ? 'PERMISSION_ERROR' : 'VALIDATION_ERROR';
    const statusCode = isCrossTenant ? 403 : 400;
    super(`[${identityCode}] ${message}`, code, statusCode, { identityCode, ...details });
    this.identityCode = identityCode;
  }
}

export function isActivityIdentityError(error: unknown): error is ActivityIdentityError {
  return error instanceof ActivityIdentityError;
}
