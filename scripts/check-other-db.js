const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/aurianoa_sto?schema=public';

async function checkOtherDb() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- Organizations in aurianoa_sto ---');
    const orgs = await client.query("SELECT id, name, slug FROM \"Organization\"");
    console.log(JSON.stringify(orgs.rows, null, 2));
    
    console.log('\n--- Users in aurianoa_sto ---');
    const users = await client.query("SELECT id, email, organization_id, name FROM \"User\"");
    console.log(JSON.stringify(users.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkOtherDb();
