const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'info@syority.com' } });
    if (!user) return console.log('User not found.');

    let platformRole = await prisma.role.findFirst({
        where: { organization_id: user.organization_id, slug: 'platform_super_admin' }
    });

    if (!platformRole) {
         platformRole = await prisma.role.create({
            data: {
                organization_id: user.organization_id,
                name: 'Platform Super Admin',
                slug: 'platform_super_admin',
                permissions: ['nav.admin', 'settings.view'],
                is_system: true
            }
        });
        console.log('Created PLATFORM_SUPER_ADMIN role.');
    }

    const existingUserRole = await prisma.userRole.findFirst({
        where: { user_id: user.id, role_id: platformRole.id }
    });

    if (!existingUserRole) {
        await prisma.userRole.create({
            data: { user_id: user.id, role_id: platformRole.id, organization_id: user.organization_id }
        });
        console.log('Assigned PLATFORM_SUPER_ADMIN role to info@syority.com successfully.');
    } else {
         console.log('User already has PLATFORM_SUPER_ADMIN role.');
    }
}

main().finally(() => prisma.$disconnect());
