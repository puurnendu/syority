import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

/**
 * PROJECT-SCOPED SAFETY — NOT AVAILABLE (fail-closed)
 *
 * OD9.2 §22 classification: **B — STO, withdrawn from the Project domain.**
 *
 * Safety and Permit Management belong exclusively to STO. This route read
 * `prisma.safetyLog` filtered by `project_id`, which is a vestigial nullable column with no
 * foreign key on a table whose authoritative scope is the Event: `SafetyLog.event_id` is
 * `NOT NULL`. Safety is therefore structurally Event-owned, and a Project-scoped safety feed
 * is not a legitimate view of it.
 *
 * Note on why this now matters: the handler previously used pre-OD9 camelCase field names
 * (`orgId`, `projectId`, `logDate`), so every call threw at the Prisma layer. Repairing those
 * names would have turned a dead route into a working Project→STO-Safety read. It is
 * fail-closed instead.
 *
 * Retained rather than deleted (§22 forbids deleting real STO Safety functionality, §27
 * forbids unproven cleanup). Nothing is lost: this route has **zero** production consumers,
 * `SafetyLog` has 0 rows, and the real STO safety surfaces are unaffected —
 * `/safety` (org daily HSE log) and `/api/events/[eventId]/safety` (+ `/incidents`,
 * `/photos`), all Event-scoped and tenant-filtered.
 */
const PROJECT_SAFETY_UNAVAILABLE = {
  error: 'PROJECT_SAFETY_NOT_AVAILABLE',
  message:
    'Safety is owned by the STO domain and is not available at Project scope. ' +
    'SafetyLog.event_id is NOT NULL, so safety records belong to an STO Event. ' +
    'Use /api/events/{eventId}/safety.',
  documentation: 'docs/AURIANOA_R1.0_OD9_2_PROJECT_DOMAIN_SEPARATION_RESULT.md §17',
} as const;

export const GET = withTenantGuard(async (_req: NextRequest) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  return NextResponse.json(PROJECT_SAFETY_UNAVAILABLE, { status: 501 });
});
