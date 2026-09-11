/**
 * R0.2 preflight: schema + snapshot capability. Read-only.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { prisma, disconnect } from '../prisma/seed-client';

async function main() {
  const db = await prisma.$queryRaw<Array<{ db: string; now: Date }>>`
    SELECT current_database() AS db, NOW() AS now
  `;

  const auditCols = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog'
    ORDER BY ordinal_position
  `;

  const baselineExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'BaselineActivity'
    ) AS exists
  `;

  let baselineCount = 0;
  if (baselineExists[0]?.exists) {
    const rows = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM "BaselineActivity"
    `;
    baselineCount = rows[0]?.n ?? 0;
  }

  const candidates = await prisma.$queryRaw<Array<{
    id: string;
    organization_id: string;
    workpack_id: string;
    event_id: string | null;
    discipline_id: string | null;
    standard_activity_type_id: string | null;
    wp_event_id: string;
    wp_org: string;
  }>>`
    SELECT
      a.id, a.organization_id, a.workpack_id, a.event_id,
      a.discipline_id, a.standard_activity_type_id,
      w.event_id AS wp_event_id, w.organization_id AS wp_org
    FROM "Activity" a
    JOIN "Workpack" w ON w.id = a.workpack_id
    WHERE a.deleted_at IS NULL
      AND a.event_id IS NULL
      AND w.event_id IS NOT NULL
      AND w.organization_id = a.organization_id
    ORDER BY a.id
  `;

  const identityChecksum = await prisma.$queryRaw<Array<{ checksum: string }>>`
    SELECT md5(string_agg(id::text || coalesce(event_id::text,'') || coalesce(discipline_id::text,'') || coalesce(standard_activity_type_id::text,''), '|' ORDER BY id)) AS checksum
    FROM "Activity"
  `;

  const dir = join(process.cwd(), 'var', 'r02-identity-backfill');
  mkdirSync(dir, { recursive: true });
  const snapshot = {
    read_only: true,
    database: db[0],
    audit_columns: auditCols,
    baseline_activity_count: baselineCount,
    identity_checksum_all_activities: identityChecksum[0]?.checksum,
    deterministic_event_candidates: candidates,
  };
  writeFileSync(join(dir, 'preflight-snapshot.json'), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({
    database: db[0],
    audit_has_context: auditCols.some((c) => c.column_name === 'context'),
    audit_column_count: auditCols.length,
    baseline_activity_count: baselineCount,
    identity_checksum_all_activities: identityChecksum[0]?.checksum,
    deterministic_event_candidate_count: candidates.length,
    persisted: join(dir, 'preflight-snapshot.json'),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
