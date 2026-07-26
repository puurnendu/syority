const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/aurianoa_sto?schema=public';

async function checkUsers() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- Users in aurianoa_sto ---');
    const users = await client.query("SELECT * FROM \"users\" WHERE email = 'purnendu@syority.com'");
    console.log(JSON.stringify(users.rows, null, 2));

    console.log('\n--- All users in aurianoa_sto (first 10) ---');
    const allUsers = await client.query("SELECT email FROM \"users\" LIMIT 10");
    console.log(JSON.stringify(allUsers.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkUsers();
