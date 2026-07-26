import 'dotenv/config';
import pg from 'pg';

async function main() {
  const c = new pg.Client(process.env.DATABASE_URL);
  await c.connect();
  const r = await c.query(`
    SELECT id, provider,
           LEFT(api_key_encrypted, 30) AS key_prefix,
           POSITION(':' IN api_key_encrypted) > 0 AS has_colon
    FROM "AiProviderSetting"
    WHERE api_key_encrypted IS NOT NULL
  `);
  console.table(r.rows);
  await c.end();
}

main();
