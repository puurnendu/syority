import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

/**
 * PROJECT BASELINE BRANCHING — NOT IMPLEMENTED (fail-closed)
 *
 * OD9.2 §16 classification: **F — LEGACY / OBSOLETE, retained not deleted.**
 *
 * This route implemented a "baseline as a cloned Project" model (Primavera-style
 * baseline projects) via `ProjectBranchingService`. It has never been functional
 * against the current schema, and it cannot be repaired within OD9.2:
 *
 *   1. It reads `Project.activities`. That relation cannot exist, because it requires
 *      `Activity.project_id` — a column OD9.1 proved was never present in the database
 *      and formally retired. OD9.2 §8 states "Do NOT reintroduce Activity.project_id",
 *      so the clone loop is unrepairable by instruction, not merely by defect.
 *   2. It reads/writes `Project.isBaseline`, `Project.parentProjectId` and
 *      `Project.primaryBaselineId`. None of these exist in `prisma/schema.prisma`
 *      **or** in the live database (verified against `syority`: the `"Project"` table
 *      has 18 columns and none of them are these three). Adding them is a schema
 *      change, and OD9.2 §24 forbids migrations that are not strictly necessary.
 *   3. Its GET/DELETE handlers were additionally unscoped by tenant
 *      (`findMany({ where: { parentProjectId, isBaseline } })`, `delete({ where: { id } })`),
 *      so had the fields existed they would have permitted cross-tenant reads and deletes.
 *
 * OD9.2 §16.4 states "Do not silently delete it merely because it is broken", so the
 * service file and this route are **retained**. They now fail closed with an explicit
 * 501 instead of throwing an opaque Prisma error, which also removes the cross-tenant
 * delete hazard in (3).
 *
 * **Project baselines themselves are NOT retired.** The legitimate, schema-aligned
 * Project baseline authority is `POST /api/projects/[id]/baseline` (singular), which
 * snapshots activities into `ScheduleBaseline` + `BaselineActivity` using the real
 * `ScheduleBaseline.project_id` column. STO baselines remain Event-owned via
 * `ScheduleBaseline.event_id` and are unaffected.
 *
 * Recorded as OD9-035. Reinstating baseline branching is a product decision plus an
 * authorized migration — logged as an OD9.4 migration candidate, not a defect fix.
 */
const NOT_IMPLEMENTED = {
  error: 'PROJECT_BASELINE_BRANCHING_NOT_IMPLEMENTED',
  message:
    'Project baseline branching (baseline-as-cloned-project) is not implemented. ' +
    'Use POST /api/projects/[id]/baseline to snapshot a Project baseline.',
  documentation: 'docs/AURIANOA_R1.0_OD9_2_PROJECT_DOMAIN_SEPARATION_RESULT.md §10',
} as const;

export const GET = withTenantGuard(async (_req: NextRequest) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
});

export const POST = withTenantGuard(async (_req: NextRequest) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
});

export const DELETE = withTenantGuard(async (_req: NextRequest) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
});
