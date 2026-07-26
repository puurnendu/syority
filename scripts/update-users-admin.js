
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const emails = ['joyal.pk@syority.com', 'jay.rathod@syority.com', 'jayrukh.rathod@syority.com'];
    
    console.log('Updating is_super_admin flag for users:', emails);
    
    try {
        const result = await prisma.$executeRaw`
            UPDATE "User"
            SET is_super_admin = true
            WHERE email IN (${emails[0]}, ${emails[1]}, ${emails[2]})
        `;
        console.log('Update result (rows affected):', result);
    } catch (e) {
        console.error('Update failed:', e.message);
        console.log('Attempting alternative update without raw if column exists in Prisma but I missed it...');
        try {
            const updated = await prisma.user.updateMany({
                where: { email: { in: emails } },
                data: { is_super_admin: true }
            });
            console.log('Update many result:', updated);
        } catch (e2) {
            console.error('Alternative update also failed:', e2.message);
        }
    }

    try {
        const allSuperAdmins = await prisma.$executeRaw`
            UPDATE "User"
            SET is_super_admin = true
            WHERE role = 'super_admin' OR role = 'SUPER_ADMIN'
        `;
        console.log('Global SuperAdmin update result:', allSuperAdmins);
    } catch (e) {
        console.error('Global update failed:', e.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
