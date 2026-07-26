
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({
    where: { email: 'superadmin@aurianoa.com' },
    include: {
      organization: true,
      user_roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('User:', user.name);
  console.log('Email:', user.email);
  console.log('Organization:', user.organization.name, '(', user.organization.slug, ')');
  console.log('Roles:', user.user_roles.map(ur => ur.role.slug));
  console.log('is_super_admin:', user.is_super_admin);
}

checkUser().catch(console.error).finally(() => prisma.$disconnect());
