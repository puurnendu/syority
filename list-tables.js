const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public",
});

async function main() {
    try {
        const client = await pool.connect();
        const tables = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('Tables in public schema:', tables.rows.map(r => r.tablename));

        const count = await client.query('SELECT count(*) FROM "User"'); // This might fail if table doesn't exist
        console.log('User count:', count.rows[0].count);

        client.release();
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}
main();
