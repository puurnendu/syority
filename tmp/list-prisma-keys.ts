import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const keys = Object.keys(prisma);
  console.log('Prisma Client Model Keys:', JSON.stringify(keys.filter(k => !k.startsWith('$')), null, 2));
  await prisma.$disconnect();
}

main();
