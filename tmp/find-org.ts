import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst();
  console.log('Valid Organization:', JSON.stringify(org, null, 2));
  await prisma.$disconnect();
}

main();
