/**
 * Sprint 1b pre-flip census: how many live activities have planner-typed
 * planned_start / planned_end, and whether override columns already exist.
 */
import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function main() {
  const cols = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Activity'
      AND column_name IN (
        'planned_start', 'planned_end',
        'planned_start_override', 'planned_end_override',
        'planned_derived_start', 'planned_derived_end',
        'planned_override_reason', 'planned_override_by', 'planned_override_at'
      )
    ORDER BY column_name
  `);
  console.log('ACTIVITY_COLUMNS', cols.rows.map((r) => r.column_name).join(','));

  const counts = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE planned_start IS NOT NULL AND deleted_at IS NULL) AS planned_start_n,
      COUNT(*) FILTER (WHERE planned_end   IS NOT NULL AND deleted_at IS NULL) AS planned_end_n,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND (planned_start IS NOT NULL OR planned_end IS NOT NULL)) AS either_n,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND (planned_start IS NOT NULL OR planned_end IS NOT NULL)) AS deleted_with_dates
    FROM "Activity"
  `);
  console.log('CENSUS', JSON.stringify(counts.rows[0], null, 2));

  const hasOverride = cols.rows.some((r) => r.column_name === 'planned_start_override');
  if (hasOverride) {
    const ov = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE planned_start_override IS NOT NULL AND deleted_at IS NULL) AS start_override_n,
        COUNT(*) FILTER (WHERE planned_end_override   IS NOT NULL AND deleted_at IS NULL) AS end_override_n,
        COUNT(*) FILTER (WHERE planned_override_reason IS NOT NULL AND deleted_at IS NULL) AS reason_n
      FROM "Activity"
    `);
    console.log('OVERRIDE_CENSUS', JSON.stringify(ov.rows[0], null, 2));
  } else {
    console.log('OVERRIDE_CENSUS', 'columns_absent');
  }

  const mig = await pool.query(`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    WHERE migration_name LIKE '%sprint1b%' OR migration_name LIKE '%sprint1a%'
    ORDER BY finished_at
  `);
  console.log('MIGRATIONS', JSON.stringify(mig.rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
