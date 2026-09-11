import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

/**
 * PROJECT IMPORTED-SCHEDULE — NOT AVAILABLE (fail-closed)
 *
 * OD9.2 §15 classification: **F — legacy / obsolete, retained.**
 *
 * Repair is impossible without a change that OD9.2 is forbidden to make. The handlers
 * depended on four things, and every one of them is absent from the schema:
 *
 *   1. `Activity.project_id`   — retired in OD9.1. **§8 forbids reintroducing it.**
 *   2. `Activity.import_batch` — no such relation exists.
 *   3. `Activity.import_batch_id` — no such column exists. (`import_batch_id` appears only on
 *      the unrelated `item_catalog` and `ExtractionCandidate` models.)
 *   4. `ScheduleImportBatch`   — **no such model exists anywhere in prisma/schema.prisma.**
 *
 * Supplying (2)–(4) means adding a model and two columns, which **§24 forbids** in this task.
 * Supplying (1) is forbidden outright. So there is no legitimate repair available here.
 *
 * The failure was silent rather than typed: the filter objects were declared `any`, so
 * TypeScript accepted `project_id` while Prisma rejected it at runtime. Every GET threw, and
 * DELETE would have thrown on `prisma.scheduleImportBatch`.
 *
 * This route is also the last live fragment of a subsystem already deprecated elsewhere:
 * M11-R0 retired schedule import, and the sibling `import/*` routes return 410.
 *
 * Retained rather than deleted (§27). Recorded as OD9-049 and as OD9.4 migration
 * candidate MC-7.
 *
 * **P6 / MS Project / Excel interchange is unaffected** and remains the supported path
 * (§11): `/integrations/import`, `/integrations/export`.
 */
const IMPORTED_SCHEDULE_UNAVAILABLE = {
  error: 'PROJECT_IMPORTED_SCHEDULE_NOT_AVAILABLE',
  message:
    'The Project imported-schedule view is not available: it requires Activity.project_id ' +
    '(retired) and a ScheduleImportBatch model that does not exist in the schema. ' +
    'Use /integrations/import and /integrations/export for schedule interchange.',
  documentation: 'docs/AURIANOA_R1.0_OD9_2_PROJECT_DOMAIN_SEPARATION_RESULT.md §22',
} as const;

/**
 * GET /api/projects/[id]/imported-schedule
 * Returns the empty shape the legacy client expects, plus the reason, so the page renders its
 * empty state rather than an error banner.
 */
export const GET = withTenantGuard(async (_req: NextRequest) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  return NextResponse.json({
    activities: [],
    batches: [],
    unitProgress: [],
    ...IMPORTED_SCHEDULE_UNAVAILABLE,
  });
});

/**
 * DELETE /api/projects/[id]/imported-schedule
 * Fails closed. It previously attempted to delete activities and an import-batch record via
 * columns and a model that do not exist; it must never be repaired into a working bulk delete
 * without an authorised schema decision.
 */
export const DELETE = withTenantGuard(async (_req: NextRequest) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  return NextResponse.json(IMPORTED_SCHEDULE_UNAVAILABLE, { status: 501 });
});
