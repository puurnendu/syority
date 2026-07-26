import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const wp = await prisma.workpack.findFirst({
      select: {
        _count: true
      }
    });
    console.log('Workpack _count result:', JSON.stringify(wp?._count, null, 2));
  } catch (err: any) {
    console.error('Prisma Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
