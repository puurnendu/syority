/**
 * Milestone derivation — the single read path for "is this activity a milestone?".
 *
 * There is no `Activity.is_milestone` column and OD9.1 deliberately did not create one.
 * Milestone-ness is *derived*, and the authority for the derivation is the EVM 0/100
 * rule already implemented in `src/core/evm/EvmCalculationService.ts` (`calculateEv`):
 *
 *     work_category === 'MILESTONE' || duration_hours === 0 || duration_hours === null
 *
 * This module exists only so that the three read sites that previously filtered on the
 * nonexistent column do not each restate that rule — it is not a second milestone
 * calculation and it must not diverge from `calculateEv`. If the EVM semantics change,
 * change them there and mirror them here.
 */

/** The `work_category` value that marks an activity as a milestone outright. */
export const MILESTONE_WORK_CATEGORY = 'MILESTONE';

/**
 * Row-level predicate, for callers that already hold an activity in memory.
 * Mirrors `calculateEv`'s `isMilestone`, including its treatment of a null duration.
 */
export function isMilestoneActivity(activity: {
  work_category?: string | null;
  duration_hours?: unknown;
}): boolean {
  if (activity.work_category === MILESTONE_WORK_CATEGORY) return true;
  const duration = activity.duration_hours;
  if (duration === null || duration === undefined) return true;
  return Number(duration) === 0;
}

/**
 * Prisma `where` fragment selecting the same set in the database, so milestone reports do
 * not have to load every activity to filter in memory.
 *
 * Spread it into a `where` that has no other top-level `OR`:
 *
 *     where: { organization_id: orgId, ...milestoneWhere() }
 */
export function milestoneWhere() {
  return {
    OR: [
      { work_category: MILESTONE_WORK_CATEGORY },
      { duration_hours: 0 },
      { duration_hours: null },
    ],
  };
}
