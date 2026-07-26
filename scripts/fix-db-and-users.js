
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
    });

    try {
        await client.connect();
        
        // 1. Ensure columns exist (just in case)
        const colRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'User' AND column_name = 'is_super_admin'
        `);
        if (colRes.rows.length === 0) {
            console.log('Adding missing columns...');
            await client.query(`ALTER TABLE "User" ADD COLUMN is_super_admin BOOLEAN DEFAULT false`);
            await client.query(`ALTER TABLE "User" ADD COLUMN is_tenant_admin BOOLEAN DEFAULT false`);
        }

        // 2. Update specific users by email
        const emails = ['joyal.pk@syority.com', 'jay.rathod@syority.com', 'jayrukh.rathod@syority.com'];
        const updateEmailRes = await client.query(`
            UPDATE "User"
            SET is_super_admin = true
            WHERE email = ANY($1)
        `, [emails]);
        console.log('Update by email result:', updateEmailRes.rowCount);

        // 3. Update all users who have the 'super_admin' role (case-insensitive)
        const updateRoleRes = await client.query(`
            UPDATE "User"
            SET is_super_admin = true
            WHERE id IN (
                SELECT ur.user_id 
                FROM "UserRole" ur
                JOIN "Role" r ON ur.role_id = r.id
                WHERE r.slug ILIKE 'super_admin' OR r.slug ILIKE 'super-admin'
            )
        `);
        console.log('Update by role join result:', updateRoleRes.rowCount);

        // 4. Verify
        const verifyRes = await client.query(`
            SELECT u.email, u.is_super_admin, r.slug as role_slug
            FROM "User" u
            LEFT JOIN "UserRole" ur ON u.id = ur.user_id
            LEFT JOIN "Role" r ON ur.role_id = r.id
            WHERE u.email = ANY($1)
        `, [emails]);
        console.log('Verification state:', JSON.stringify(verifyRes.rows, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}
main();
