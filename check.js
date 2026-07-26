const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({
  where: { email: 'info@syority.com' },
  include: { user_roles: { include: { role: true } } }
}).then(u => {
  if (!u) {
    console.log('USER NOT FOUND');
    return;
  }
  console.log('DB ROLE SLUGS:', u.user_roles.map(ur => ur.role.slug));
}).catch(console.error).finally(() => prisma.$disconnect());
