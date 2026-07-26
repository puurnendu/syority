const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking info@syority.com ---');
    const user = await prisma.user.findUnique({
        where: { email: 'info@syority.com' },
        include: {
            organization: true,
            user_roles: {
                include: { role: true }
            }
        }
    });

    if (!user) {
        console.log('User not found.');
        return;
    }

    console.log('Email:', user.email);
    console.log('Organization:', user.organization?.name);
    
    console.log('\nAssigned Roles (from user_roles):');
    if (user.user_roles.length === 0) {
        console.log(' (No roles assigned via user_roles)');
    } else {
        user.user_roles.forEach(ur => {
            console.log(` - ${ur.role.name} [slug: ${ur.role.slug}]`);
        });
    }
}

main().finally(() => prisma.$disconnect());
