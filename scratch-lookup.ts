import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: 'info@syority.com'
    },
    select: {
      id: true,
      email: true
    }
  });

  console.log('--- USER DATA ---');
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
