/**
 * Sprint 1b — planned dates are CPM-derived (M11). Silent writers must
 * not persist planned_start / planned_end. The only mutation path is
 * PlannedDateAuthority.applyOverride (audited TYPE 5).
 */

export const PLANNED_DATE_FIELDS = ['planned_start', 'planned_end'] as const;
export type PlannedDateField = (typeof PLANNED_DATE_FIELDS)[number];

export const PLANNED_DATE_REJECT_MESSAGE =
  'planned_start/planned_end are CPM-derived (M11). Set them only through the audited override path (reason, user, timestamp).';

export class PlannedDateAuthorityError extends Error {
  readonly status = 409;
  readonly code = 'PLANNED_DATE_AUTHORITY';
  readonly rejectedFields: string[];

  constructor(message: string, rejectedFields: string[] = []) {
    super(message);
    this.name = 'PlannedDateAuthorityError';
    this.rejectedFields = rejectedFields;
  }
}

export function listedPlannedDateFields(body: Record<string, unknown> | null | undefined): PlannedDateField[] {
  if (!body) return [];
  return PLANNED_DATE_FIELDS.filter((field) => body[field] !== undefined);
}

export function assertNoSilentPlannedDateWrite(body: Record<string, unknown> | null | undefined): void {
  const listed = listedPlannedDateFields(body);
  if (listed.length > 0) {
    throw new PlannedDateAuthorityError(
      `${PLANNED_DATE_REJECT_MESSAGE} Rejected fields: ${listed.join(', ')}`,
      listed
    );
  }
}

export function stripPlannedDateFields<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data };
  for (const field of PLANNED_DATE_FIELDS) {
    delete next[field];
  }
  return next;
}
