const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, error_message, response 
            FROM ai_logs 
            WHERE status = 'failed' 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No failed logs found.');
            return;
        }

        const log = res.rows[0];
        console.log('LOG ID:', log.id);
        console.log('ERROR:', log.error_message);
        console.log('RESPONSE:');
        console.log(log.response);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
