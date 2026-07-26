require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('--- DUPLICATE CHECK START ---');
    const duplicates = await prisma.$queryRaw`SELECT email, COUNT(*) as count FROM "User" WHERE deleted_at IS NULL GROUP BY email HAVING COUNT(*) > 1`;
    const serialized = duplicates.map(d => ({ email: d.email, count: String(d.count) }));
    console.log(JSON.stringify(serialized, null, 2));
    console.log('--- DUPLICATE CHECK END ---');
}
main().finally(() => prisma.$disconnect());
