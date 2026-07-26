const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';

async function checkAudit() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- Search for purnendu in any table ---');
    const tables = ['User', 'Organization', 'AuditLog'];
    for (const table of tables) {
      const res = await client.query(`SELECT count(*) FROM "${table}" WHERE CAST(row_to_json("${table}")::text AS text) ILIKE '%purnendu%'`);
      console.log(`Table ${table}: ${res.rows[0].count} matches`);
    }

    console.log('\n--- Recent Audit Logs ---');
    try {
        const audit = await client.query(`SELECT * FROM "AuditLog" ORDER BY created_at DESC LIMIT 20`);
        console.log(JSON.stringify(audit.rows, null, 2));
    } catch (e) {
        console.log('AuditLog table might not exist or be named differently:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkAudit();
