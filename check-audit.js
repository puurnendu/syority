const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public",
});

async function main() {
    try {
        const client = await pool.connect();
        const logs = await client.query('SELECT * FROM "AuditLog" ORDER BY created_at DESC LIMIT 20');
        console.log('Recent Audit Logs:', JSON.stringify(logs.rows, null, 2));

        const totalLogs = await client.query('SELECT count(*) FROM "AuditLog"');
        console.log('Total Audit Logs:', totalLogs.rows[0].count);

        client.release();
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}
main();
