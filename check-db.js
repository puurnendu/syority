const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Inspection ---');

    try {
        const orgs = await prisma.organization.findMany({
            select: { id: true, name: true, slug: true }
        });
        console.log('Organizations:', JSON.stringify(orgs, null, 2));

        const users = await prisma.user.findMany({
            select: { id: true, email: true, organization_id: true }
        });
        console.log('Users:', JSON.stringify(users, null, 2));

        const workpacks = await prisma.workpack.findMany({
            select: { id: true, title: true, organization_id: true, workpack_number: true, deleted_at: true }
        });
        console.log('Workpacks found:', workpacks.length);
        workpacks.forEach(wp => {
            console.log(`- [${wp.workpack_number}] ${wp.title} (Org: ${wp.organization_id}) ${wp.deleted_at ? '[DELETED]' : ''}`);
        });

        if (workpacks.length === 0) {
            console.log('No workpacks found in the database.');
        }
    } catch (err) {
        console.error('Error during inspection:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
