const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';

async function checkTimestamps() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- Organization Timestamps ---');
    const orgs = await client.query("SELECT name, created_at, updated_at FROM \"Organization\" ORDER BY created_at DESC");
    console.log(JSON.stringify(orgs.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTimestamps();
