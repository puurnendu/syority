const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';

async function checkNewUser() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log('--- Organizations ---');
    const orgs = await client.query("SELECT id, name, slug, is_active FROM \"Organization\" WHERE name ILIKE '%YARA%'");
    console.log(JSON.stringify(orgs.rows, null, 2));
    
    console.log('\n--- Users ---');
    const users = await client.query("SELECT id, email, organization_id, is_active, deleted_at FROM \"User\" WHERE email = 'purnendu@syority.com'");
    console.log(JSON.stringify(users.rows, null, 2));

    if (users.rows.length > 0) {
      const userId = users.rows[0].id;
      console.log('\n--- User Roles ---');
      const roles = await client.query(`
        SELECT r.name, r.slug 
        FROM "UserRole" ur 
        JOIN "Role" r ON ur.role_id = r.id 
        WHERE ur.user_id = $1
      `, [userId]);
      console.log(JSON.stringify(roles.rows, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkNewUser();
