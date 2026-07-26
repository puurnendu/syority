const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        console.log('--- ORGANIZATIONS ---');
        const orgs = await prisma.organization.findMany();
        orgs.forEach(o => console.log(`Slug: ${o.slug} | Name: ${o.name} | ID: ${o.id}`));

        console.log('\n--- USERS ---');
        const users = await prisma.user.findMany({
            include: { organization: true }
        });
        users.forEach(u => {
            console.log(`Email: ${u.email} | Org: ${u.organization?.name} (${u.organization?.slug})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
