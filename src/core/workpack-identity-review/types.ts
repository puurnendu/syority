/**
 * R0.4-D — Workpack identity review types.
 * Review state is not Workpack.status.
 */

export const REVIEW_SOURCE = 'R0.4D_WORKPACK_IDENTITY_REVIEW';

export const GENERIC_WORKPACK_NOT_FOUND = 'Workpack was not found';
export const GENERIC_EVENT_NOT_FOUND = 'Event was not found';

export type ReviewState =
  | 'UNREVIEWED'
  | 'CANDIDATE'
  | 'HUMAN_CONFIRMED'
  | 'APPLIED'
  | 'REJECTED'
  | 'QUARANTINED'
  | 'DEFERRED';

export type Classification =
  | 'DIRECT'
  | 'STRONG'
  | 'WEAK'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT'
  | 'NON_STO'
  | 'CONFLICTING_CHILD_EVENT';

export type PathStatus = 'FOUND' | 'NOT_FOUND' | 'CONFLICTING';

export type ReviewDecision =
  | 'ASSIGN'
  | 'QUARANTINE'
  | 'DEFER'
  | 'REJECT'
  | 'ROLLBACK';

export type EvidenceStrength = 'DIRECT' | 'STRONG' | 'WEAK';

export interface ReviewActor {
  userId: string;
  organizationId: string;
  canViewWorkpacks: boolean;
  canEditWorkpacks: boolean;
  canApproveWorkpacks: boolean;
  canViewEvents: boolean;
}

export interface EventCandidateView {
  eventId: string;
  code: string;
  name: string;
  siteName: string | null;
  plannedStart: Date | string | null;
  plannedEnd: Date | string | null;
  status: string;
  sources: string[];
  strength: EvidenceStrength;
  activityRefs: string[];
}

export interface EvidencePath {
  key: string;
  label: string;
  status: PathStatus;
  eventCodes: string[];
  detail: string;
}

export interface ChildMismatch {
  activityId: string;
  activityLabel: string;
  activityEventId: string | null;
  activityEventCode: string | null;
  workpackEventId: string;
}

export interface ReviewPermissions {
  canAssign: boolean;
  canQuarantine: boolean;
  canResolveConflict: boolean;
  canRollback: boolean;
}
