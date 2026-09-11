/**
 * R0.2 read-only forensic census. Does not UPDATE any row.
 * Usage: npx tsx scripts/r02-census-readonly.ts
 */
import { prisma, disconnect } from '../prisma/seed-client';

function nums(row: Record<string, unknown> | undefined) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v)]));
}

async function main() {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Activity'
    ORDER BY ordinal_position
  `;
  const activityColumns = columns.map((c) => c.column_name);
  const hasProjectId = activityColumns.includes('project_id');
  const hasScheduleSource = activityColumns.includes('schedule_source');

  const env = await prisma.$queryRaw<Array<{ current_database: string; now: Date }>>`
    SELECT current_database(), NOW() AS now
  `;

  const totals = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::bigint AS soft_deleted,
      COUNT(*) FILTER (WHERE deleted_at IS NULL)::bigint AS live,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NULL)::bigint AS missing_event,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NOT NULL)::bigint AS has_event,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND workpack_id IS NULL)::bigint AS loose,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND workpack_id IS NOT NULL)::bigint AS has_workpack,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND discipline_id IS NULL)::bigint AS missing_discipline,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND discipline_id IS NOT NULL)::bigint AS has_discipline,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND standard_activity_type_id IS NULL)::bigint AS missing_sat,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND standard_activity_type_id IS NOT NULL)::bigint AS has_sat,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND (p6_activity_id IS NOT NULL OR p6_object_id IS NOT NULL))::bigint AS p6_legacy
    FROM "Activity"
  `;

  const joins = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.workpack_id IS NOT NULL AND w.id IS NULL)::bigint AS workpack_missing,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND w.id IS NOT NULL AND w.organization_id IS DISTINCT FROM a.organization_id)::bigint AS workpack_cross_tenant,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND w.id IS NOT NULL AND w.event_id IS NULL)::bigint AS workpack_event_missing,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NOT NULL AND w.event_id IS NOT NULL AND a.event_id = w.event_id)::bigint AS event_agrees,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NOT NULL AND w.event_id IS NOT NULL AND a.event_id IS DISTINCT FROM w.event_id)::bigint AS event_contradiction,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NULL AND w.event_id IS NOT NULL AND w.organization_id = a.organization_id)::bigint AS event_deterministic_candidate,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.event_id IS NULL AND a.workpack_id IS NOT NULL AND (w.id IS NULL OR w.event_id IS NULL OR w.organization_id IS DISTINCT FROM a.organization_id))::bigint AS event_unresolved_workpack_backed,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND d.id IS NOT NULL AND d.organization_id = a.organization_id AND COALESCE(d.is_active, true) = true)::bigint AS discipline_valid,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.discipline_id IS NOT NULL AND (d.id IS NULL OR d.organization_id IS DISTINCT FROM a.organization_id))::bigint AS discipline_invalid_or_cross_tenant,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.discipline_id IS NULL AND w.discipline_id IS NOT NULL AND wd.id IS NOT NULL AND wd.organization_id = a.organization_id)::bigint AS discipline_from_workpack_candidate,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND sat.id IS NOT NULL)::bigint AS sat_fk_exists,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.standard_activity_type_id IS NOT NULL AND sat.id IS NULL)::bigint AS sat_fk_invalid,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND ast.organization_id IS NOT NULL AND ast.organization_id IS DISTINCT FROM a.organization_id)::bigint AS asset_cross_tenant,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND w.id IS NOT NULL AND w.asset_id IS NULL)::bigint AS equipment_context_missing,
      COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.activity_library_id IS NOT NULL)::bigint AS has_library_link
    FROM "Activity" a
    LEFT JOIN "Workpack" w ON w.id = a.workpack_id
    LEFT JOIN "Discipline" d ON d.id = a.discipline_id
    LEFT JOIN "Discipline" wd ON wd.id = w.discipline_id
    LEFT JOIN "standard_activity_types" sat ON sat.id = a.standard_activity_type_id
    LEFT JOIN "Asset" ast ON ast.id = w.asset_id
  `;

  const result = {
    read_only: true,
    database: env[0],
    schema_notes: {
      activity_has_project_id: hasProjectId,
      activity_has_schedule_source: hasScheduleSource,
      activity_columns: activityColumns,
    },
    totals: nums(totals[0]),
    joins: nums(joins[0]),
  };
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
