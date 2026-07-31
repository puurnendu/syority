import { prisma, disconnect } from '../prisma/seed-client';

async function main() {
    console.log('Targeting info@syority.com (Platform Admin Role Assignment)');

    const user = await prisma.user.findUnique({
        where: { email: 'info@syority.com' },
        include: { user_roles: { include: { role: true } } }
    });

    if (!user) {
        console.log('User not found.');
        return;
    }

    console.log('User found:', user.id, user.name);

    let platformRole = await prisma.role.findFirst({
        where: {
            organization_id: user.organization_id,
            slug: 'platform_super_admin'
        }
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

    const hasRole = user.user_roles.some(ur => ur.role_id === platformRole?.id);

    if (!hasRole) {
        await prisma.userRole.create({
            data: {
                user_id: user.id,
                role_id: platformRole.id,
                organization_id: user.organization_id
            }
        });
        console.log('Assigned PLATFORM_SUPER_ADMIN role to info@syority.com successfully.');
    } else {
         console.log('User already has PLATFORM_SUPER_ADMIN role.');
    }
}

main()
  .then(async () => {
    await disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await disconnect()
    process.exit(1)
  });
