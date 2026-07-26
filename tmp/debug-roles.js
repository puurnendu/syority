require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
async function main() {
    const roles = await prisma.role.findMany({ select: { slug: true } });
    console.log('Available Roles:', roles.map(r => r.slug));
    
    // Find some active user roles
    const userRoles = await prisma.userRole.findMany({
        include: { role: true },
        take: 20
    });
    console.log('User Role Sample:', userRoles.map(ur => ({ 
        userId: ur.user_id, 
        roleSlug: ur.role.slug 
    })));
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
