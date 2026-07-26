
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const emails = ['joyal.pk@syority.com', 'jay.rathod@syority.com', 'jayrukh.rathod@syority.com'];
    const users = await prisma.user.findMany({
        where: {
            email: { in: emails }
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            user_roles: {
                include: {
                    role: true
                }
            }
        }
    });

    // Check if is_super_admin exists on the model via introspection
    const userFields = Object.keys(prisma.user || {});
    console.log('User model fields (partial/internal):', userFields);

    console.log('Users found:', JSON.stringify(users, null, 2));

    // Try a raw query to absolutely be sure about the DB column
    try {
        const rawUsers = await prisma.$queryRaw`SELECT id, name, email, role, is_super_admin FROM "User" WHERE email IN ('joyal.pk@syority.com', 'jay.rathod@syority.com', 'jayrukh.rathod@syority.com')`;
        console.log('Raw users (includes columns not in Prisma):', JSON.stringify(rawUsers, null, 2));
    } catch (e) {
        console.log('Raw query failed - column might not exist or other error:', e.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
