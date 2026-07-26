const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';

async function checkUserTimestamps() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- User Timestamps ---');
    const users = await client.query("SELECT email, created_at FROM \"User\" ORDER BY created_at DESC");
    console.log(JSON.stringify(users.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkUserTimestamps();
