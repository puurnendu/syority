/**
 * R0.2 post-apply invariants + rollback demonstration.
 * Identity fields only. Does not run CPM / progress / execution.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { prisma, disconnect } from '../prisma/seed-client';
import { R02_SOURCE } from '../src/core/activity/identityBackfillTypes';
import type { ManifestRecord } from '../src/core/activity/identityBackfillTypes';

const RUN_ID = '13040a36-23ac-4d16-9a99-d22254402c00';
const ROOT = join(process.cwd(), 'var', 'r02-identity-backfill', RUN_ID);

async function main() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as ManifestRecord[];
  const ids = manifest.map((m) => m.activityId);

  const afterCensus = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE deleted_at IS NULL)::bigint AS live,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::bigint AS soft_deleted,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NULL)::bigint AS missing_event,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NOT NULL)::bigint AS has_event,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND workpack_id IS NULL)::bigint AS loose,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND discipline_id IS NULL)::bigint AS missing_discipline,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND standard_activity_type_id IS NULL)::bigint AS missing_sat
    FROM "Activity"
  `;

  const joins = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NOT NULL AND w.event_id IS NOT NULL AND a.event_id = w.event_id)::bigint AS event_agrees,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NOT NULL AND w.event_id IS NOT NULL AND a.event_id IS DISTINCT FROM w.event_id)::bigint AS event_contradiction,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NULL AND w.event_id IS NOT NULL AND w.organization_id = a.organization_id)::bigint AS remaining_deterministic,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND w.id IS NOT NULL AND w.organization_id IS DISTINCT FROM a.organization_id)::bigint AS workpack_cross_tenant,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND ast.organization_id IS NOT NULL AND ast.organization_id IS DISTINCT FROM a.organization_id)::bigint AS asset_cross_tenant,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NULL AND a.workpack_id IS NOT NULL AND (w.id IS NULL OR w.event_id IS NULL))::bigint AS event_unresolved_workpack_backed
    FROM "Activity" a
    LEFT JOIN "Workpack" w ON w.id = a.workpack_id
    LEFT JOIN "Asset" ast ON ast.id = w.asset_id
  `;

  const appliedRows = await prisma.$queryRaw<Array<{
    id: string;
    event_id: string | null;
    discipline_id: string | null;
    standard_activity_type_id: string | null;
    planned_start: Date | null;
    planned_end: Date | null;
    actual_start: Date | null;
    actual_end: Date | null;
    progress_percent: unknown;
    status: string | null;
  }>>`
    SELECT id, event_id, discipline_id, standard_activity_type_id,
           planned_start, planned_end, actual_start, actual_end, progress_percent, status
    FROM "Activity"
    WHERE id = ANY(${ids}::uuid[])
  `;

  const mismatch = appliedRows.filter((row) => {
    const expected = manifest.find((m) => m.activityId === row.id);
    return !expected
      || row.event_id !== expected.newValues.event_id
      || row.discipline_id !== null
      || row.standard_activity_type_id !== null;
  });

  const checksumAll = await prisma.$queryRaw<Array<{ checksum: string }>>`
    SELECT md5(string_agg(id::text || coalesce(event_id::text,'') || coalesce(discipline_id::text,'') || coalesce(standard_activity_type_id::text,''), '|' ORDER BY id)) AS checksum
    FROM "Activity"
  `;

  const checksumUntouched = await prisma.$queryRaw<Array<{ checksum: string; n: number }>>`
    SELECT
      COUNT(*)::int AS n,
      md5(string_agg(id::text || coalesce(event_id::text,'') || coalesce(discipline_id::text,'') || coalesce(standard_activity_type_id::text,''), '|' ORDER BY id)) AS checksum
    FROM "Activity"
    WHERE NOT (id = ANY(${ids}::uuid[]))
  `;

  const reconstructedBefore = await prisma.$queryRaw<Array<{ checksum: string }>>`
    SELECT md5(string_agg(
      id::text
      || CASE WHEN id = ANY(${ids}::uuid[]) THEN '' ELSE coalesce(event_id::text, '') END
      || coalesce(discipline_id::text, '')
      || coalesce(standard_activity_type_id::text, ''),
      '|' ORDER BY id
    )) AS checksum
    FROM "Activity"
  `;

  const audits = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM "AuditLog"
    WHERE context = ${R02_SOURCE}
      AND auditable_id = ANY(${ids}::uuid[])
  `;

  const newlyVisible = await prisma.$queryRaw<Array<{
    event_id: string;
    event_name: string | null;
    n: number;
  }>>`
    SELECT a.event_id, e.name AS event_name, COUNT(*)::int AS n
    FROM "Activity" a
    LEFT JOIN events e ON e.id = a.event_id
    WHERE a.id = ANY(${ids}::uuid[])
    GROUP BY a.event_id, e.name
    ORDER BY n DESC
  `;

  const remainingMissing = await prisma.$queryRaw<Array<{
    id: string;
    workpack_id: string | null;
    event_id: string | null;
    wp_event_id: string | null;
    class: string;
  }>>`
    SELECT
      a.id,
      a.workpack_id,
      a.event_id,
      w.event_id AS wp_event_id,
      CASE
        WHEN a.workpack_id IS NULL THEN 'LOOSE_ACTIVITY'
        WHEN w.event_id IS NULL THEN 'EVENT_UNRESOLVED'
        ELSE 'OTHER'
      END AS class
    FROM "Activity" a
    LEFT JOIN "Workpack" w ON w.id = a.workpack_id
    WHERE a.deleted_at IS NULL AND a.event_id IS NULL
    ORDER BY class, a.id
  `;

  // Live rollback demonstration on the first applied row, then restore.
  const demo = manifest[0];
  const beforeDemo = await prisma.$queryRaw<Array<{ event_id: string | null }>>`
    SELECT event_id FROM "Activity" WHERE id = ${demo.activityId}::uuid
  `;
  await prisma.$executeRaw`
    UPDATE "Activity"
    SET event_id = NULL, updated_at = NOW()
    WHERE id = ${demo.activityId}::uuid
      AND organization_id = ${demo.organizationId}::uuid
      AND event_id = ${demo.newValues.event_id}::uuid
  `;
  const rolled = await prisma.$queryRaw<Array<{ event_id: string | null }>>`
    SELECT event_id FROM "Activity" WHERE id = ${demo.activityId}::uuid
  `;
  await prisma.$executeRaw`
    UPDATE "Activity"
    SET event_id = ${demo.newValues.event_id}::uuid, updated_at = NOW()
    WHERE id = ${demo.activityId}::uuid
      AND organization_id = ${demo.organizationId}::uuid
      AND event_id IS NULL
      AND workpack_id = ${demo.workpackId}::uuid
  `;
  await prisma.$executeRaw`
    INSERT INTO "AuditLog" (
      id, organization_id, auditable_type, auditable_id, event, old_values, new_values, context, created_at
    ) VALUES (
      ${randomUUID()}::uuid,
      ${demo.organizationId}::uuid,
      'Activity',
      ${demo.activityId}::uuid,
      'updated',
      ${JSON.stringify({ source: R02_SOURCE, runId: RUN_ID, action: 'rollback_demo_restore' })}::jsonb,
      ${JSON.stringify({ event_id: demo.newValues.event_id, source: R02_SOURCE, runId: RUN_ID, action: 'rollback_demo_restore' })}::jsonb,
      ${R02_SOURCE},
      NOW()
    )
  `;
  const restored = await prisma.$queryRaw<Array<{ event_id: string | null }>>`
    SELECT event_id FROM "Activity" WHERE id = ${demo.activityId}::uuid
  `;

  const eventsCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
  `;

  const out = {
    database: 'syority',
    runId: RUN_ID,
    afterCensus: Object.fromEntries(Object.entries(afterCensus[0] ?? {}).map(([k, v]) => [k, Number(v)])),
    joins: Object.fromEntries(Object.entries(joins[0] ?? {}).map(([k, v]) => [k, Number(v)])),
    applied_row_mismatches: mismatch.length,
    identity_checksum_all: checksumAll[0]?.checksum,
    untouched_count: checksumUntouched[0]?.n,
    untouched_checksum: checksumUntouched[0]?.checksum,
    reconstructed_before_checksum: reconstructedBefore[0]?.checksum,
    reconstructed_matches_preflight: reconstructedBefore[0]?.checksum === '138a40e6252c497a29aa1040fcaf3866',
    audit_rows_for_applied: audits[0]?.n,
    newly_visible_by_event: newlyVisible,
    remaining_missing_event: remainingMissing,
    rollback_demo: {
      activityId: demo.activityId,
      before: beforeDemo[0]?.event_id,
      after_rollback: rolled[0]?.event_id,
      after_restore: restored[0]?.event_id,
      reproduced_previous_null: rolled[0]?.event_id === null,
      restored_to_manifest: restored[0]?.event_id === demo.newValues.event_id,
    },
    events_columns: eventsCols.map((c) => c.column_name),
    applied_non_identity_sample: appliedRows.slice(0, 3).map((r) => ({
      id: r.id,
      planned_start: r.planned_start,
      progress_percent: r.progress_percent,
      status: r.status,
    })),
  };

  writeFileSync(join(ROOT, 'post-apply-verify.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
