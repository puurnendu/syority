/**
 * M12 final balance — execution-sensitive Activity fields.
 *
 * Planning/schedule endpoints must not persist these.
 * Actual execution mutations go through ExecutionWriteService.
 */

export type GuardedExecutionAction =
  | 'START'
  | 'UPDATE_PROGRESS'
  | 'COMPLETE'
  | 'HOLD'
  | 'RESUME'
  | 'RELEASE'
  | 'VERIFY'
  | 'CLOSE';

export const EXECUTION_ACTIVITY_FIELDS = [
  'status',
  'progress_percent',
  'actual_start',
  'actual_end',
  'physical_percent_complete',
  'duration_percent_complete',
  'unit_percent_complete',
] as const;

export type ExecutionActivityField = (typeof EXECUTION_ACTIVITY_FIELDS)[number];

export const EXECUTION_FIELD_REJECT_MESSAGE =
  'Execution-sensitive fields (status, progress, actual dates) must be changed through M12 ExecutionWriteService (/api/execution/action).';

export function listedExecutionFields(body: Record<string, unknown> | null | undefined): ExecutionActivityField[] {
  if (!body) return [];
  return EXECUTION_ACTIVITY_FIELDS.filter((field) => body[field] !== undefined);
}

export function assertNoExecutionFields(body: Record<string, unknown> | null | undefined): void {
  const listed = listedExecutionFields(body);
  if (listed.length > 0) {
    throw new Error(`${EXECUTION_FIELD_REJECT_MESSAGE} Rejected fields: ${listed.join(', ')}`);
  }
}

export function stripExecutionFields<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data };
  for (const field of EXECUTION_ACTIVITY_FIELDS) {
    delete next[field];
  }
  return next;
}

/** Map a target persisted status to an EWS command given the current status. */
export function mapTargetStatusToAction(
  targetStatus: string,
  currentStatus: string
): { action: GuardedExecutionAction } | { error: string } {
  if (targetStatus === currentStatus) {
    return { error: `Activity is already ${currentStatus}` };
  }
  switch (targetStatus) {
    case 'released':
      return { action: 'RELEASE' };
    case 'in_progress':
      return { action: currentStatus === 'on_hold' || currentStatus === 'held' ? 'RESUME' : 'START' };
    case 'on_hold':
      return { action: 'HOLD' };
    case 'completed':
      return { action: 'COMPLETE' };
    case 'verified':
      return { action: 'VERIFY' };
    case 'closed':
      return { action: 'CLOSE' };
    default:
      return {
        error: `Status "${targetStatus}" cannot be set through bulk/generic CRUD. Use a governed M12 action.`,
      };
  }
}

export function mapGridFieldToExecution(
  field: string,
  value: unknown,
  currentStatus?: string
): {
  action: GuardedExecutionAction;
  progress?: number;
  execution_date?: string;
  notes?: string;
} | { error: string } {
  if (field === 'progress_percent' || field === 'progress') {
    return { action: 'UPDATE_PROGRESS', progress: Number(value) };
  }
  if (field === 'status') {
    return mapTargetStatusToAction(String(value), currentStatus ?? 'not_started');
  }
  if (field === 'actual_start') {
    return { action: 'START', execution_date: value ? String(value) : undefined };
  }
  if (field === 'actual_end') {
    return { action: 'COMPLETE', execution_date: value ? String(value) : undefined };
  }
  if (field === 'remarks' || field === 'notes') {
    return { action: 'UPDATE_PROGRESS', notes: String(value ?? '') };
  }
  return { error: `Field "${field}" is not an execution action` };
}
