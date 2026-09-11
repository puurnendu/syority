/**
 * Sprint backfill — set Activity.event_id from Workpack.event_id where missing.
 * Safe, deterministic: only updates when workpack.event_id is non-null and matches org.
 *
 * Usage:
 *   npx tsx scripts/sprint-event-id-backfill.ts           # dry-run
 *   npx tsx scripts/sprint-event-id-backfill.ts --apply    # apply updates
 */
import { prisma, disconnect } from '../prisma/seed-client';

async function main() {
  const apply = process.argv.includes('--apply');

  const candidates = await prisma.$queryRaw<
    Array<{ id: string; workpack_id: string; event_id: string; organization_id: string }>
  >`
    SELECT a.id, a.workpack_id, w.event_id, a.organization_id
    FROM "Activity" a
    INNER JOIN "Workpack" w ON w.id = a.workpack_id
    WHERE a.deleted_at IS NULL
      AND a.event_id IS NULL
      AND w.event_id IS NOT NULL
      AND w.organization_id = a.organization_id
  `;

  console.log(JSON.stringify({ apply, candidate_count: candidates.length }, null, 2));

  if (!apply) {
    console.log('Dry run only. Pass --apply to update rows.');
    return;
  }

  let updated = 0;
  for (const row of candidates) {
    const result = await prisma.activity.updateMany({
      where: {
        id: row.id,
        organization_id: row.organization_id,
        event_id: null,
        deleted_at: null,
      },
      data: { event_id: row.event_id },
    });
    updated += result.count;
  }

  const remaining = await prisma.activity.count({
    where: { deleted_at: null, workpack_id: { not: null }, event_id: null },
  });

  console.log(JSON.stringify({ updated, remaining_null_event_with_workpack: remaining }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnect());
