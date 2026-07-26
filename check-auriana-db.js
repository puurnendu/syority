const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/aurianoa_sto",
});

async function main() {
    try {
        const client = await pool.connect();
        const orgs = await client.query('SELECT count(*) FROM "Organization"');
        console.log('Org count in auriana_sto:', orgs.rows[0].count);

        const users = await client.query('SELECT email FROM "User"');
        console.log('Users in auriana_sto:', users.rows.map(r => r.email));

        const workpacks = await client.query('SELECT count(*) FROM "Workpack"');
        console.log('Workpack count in auriana_sto:', workpacks.rows[0].count);

        client.release();
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}
main();
