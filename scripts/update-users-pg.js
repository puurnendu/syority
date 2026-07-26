
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
    });

    try {
        await client.connect();
        const emails = ['joyal.pk@syority.com', 'jay.rathod@syority.com', 'jayrukh.rathod@syority.com'];
        
        console.log('Updating is_super_admin flag for users:', emails);
        
        const res = await client.query(`
            UPDATE "User"
            SET is_super_admin = true
            WHERE email = ANY($1)
        `, [emails]);
        
        console.log('Update result (rows affected):', res.rowCount);

        const res2 = await client.query(`
            UPDATE "User"
            SET is_super_admin = true
            WHERE role = 'super_admin' OR role = 'SUPER_ADMIN'
        `);
        console.log('Global SuperAdmin update result:', res2.rowCount);

        const users = await client.query(`
            SELECT id, email, role, is_super_admin FROM "User" WHERE email = ANY($1)
        `, [emails]);
        console.log('Verified users:', users.rows);

    } catch (err) {
        console.error('Database operation failed:', err.stack);
    } finally {
        await client.end();
    }
}

main();
