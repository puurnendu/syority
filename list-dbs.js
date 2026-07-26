const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/postgres",
});

async function main() {
    try {
        const client = await pool.connect();
        const dbs = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        console.log('Databases available:', dbs.rows.map(r => r.datname));
        client.release();
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}
main();
