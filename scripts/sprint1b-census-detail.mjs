import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`
  SELECT
    (deleted_at IS NOT NULL) AS deleted,
    COUNT(*) FILTER (WHERE planned_start IS NOT NULL) AS start_n,
    COUNT(*) FILTER (WHERE planned_end   IS NOT NULL) AS end_n
  FROM "Activity"
  GROUP BY 1
  ORDER BY 1
`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
