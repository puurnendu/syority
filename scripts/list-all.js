const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';

async function listAll() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- All Organizations ---');
    const orgs = await client.query("SELECT id, name, slug FROM \"Organization\" ORDER BY created_at DESC");
    console.log(JSON.stringify(orgs.rows, null, 2));
    
    console.log('\n--- All Users ---');
    const users = await client.query("SELECT id, email, organization_id, name FROM \"User\" ORDER BY created_at DESC LIMIT 50");
    console.log(JSON.stringify(users.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

listAll();
