const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public",
    connectionTimeoutMillis: 5000,
});

async function main() {
    console.log('--- Direct PG Inspection ---');
    try {
        const client = await pool.connect();
        console.log('Connected to PG successfully.');

        const orgs = await client.query('SELECT id, name FROM "Organization"');
        console.log('Organizations:', orgs.rows);

        const users = await client.query('SELECT id, email, organization_id FROM "User"');
        console.log('Users:', users.rows);

        const workpacks = await client.query('SELECT id, title, organization_id FROM "Workpack"');
        console.log('Workpacks count:', workpacks.rowCount);
        workpacks.rows.forEach(wp => {
            console.log(`- ${wp.title} (Org: ${wp.organization_id})`);
        });

        client.release();
    } catch (err) {
        console.error('PG Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
