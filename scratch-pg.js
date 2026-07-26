const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public' });

async function main() {
    await client.connect();
    const res = await client.query('SELECT id, name, email FROM "User" WHERE email = $1', ['info@syority.com']);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}
main().catch(console.error);
