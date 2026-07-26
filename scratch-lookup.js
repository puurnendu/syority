const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      user_roles: {
        some: {
          role: {
            slug: 'platform_super_admin'
          }
        }
      }
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  if (users.length === 0) {
    console.log("No platform super admins found. Let's list roles to see what exists.");
    const roles = await prisma.role.findMany({ select: { slug: true } });
    console.log("Available roles:", roles.map(r => r.slug).join(', '));
  } else {
    console.log(JSON.stringify(users, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
