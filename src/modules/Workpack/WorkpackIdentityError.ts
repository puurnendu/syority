import { AppError, type ErrorCode } from '@/lib/errors';

export type WorkpackIdentityCode =
  | 'EVENT_REQUIRED'
  | 'INVALID_EVENT'
  | 'CROSS_TENANT_EVENT';

const CROSS_TENANT_CODES: ReadonlySet<WorkpackIdentityCode> = new Set([
  'CROSS_TENANT_EVENT',
]);

/**
 * Identity rejection for STO Workpack create.
 * Does not invent a second identity engine — Event must already exist.
 */
export class WorkpackIdentityError extends AppError {
  public readonly identityCode: WorkpackIdentityCode;

  constructor(identityCode: WorkpackIdentityCode, message: string, details?: Record<string, unknown>) {
    const isCrossTenant = CROSS_TENANT_CODES.has(identityCode);
    const code: ErrorCode = isCrossTenant ? 'PERMISSION_ERROR' : 'VALIDATION_ERROR';
    const statusCode = isCrossTenant ? 403 : 400;
    super(`[${identityCode}] ${message}`, code, statusCode, { identityCode, ...details });
    this.identityCode = identityCode;
  }
}

export function isWorkpackIdentityError(error: unknown): error is WorkpackIdentityError {
  return error instanceof WorkpackIdentityError;
}
