const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Prisma connection...');
    const count = await prisma.Activity.count();
    console.log('Activity count:', count);
    
    const wpCount = await prisma.Workpack.count();
    console.log('Workpack count:', wpCount);
    
    console.log('SUCCESS: Prisma connection and model names verified.');
  } catch (err) {
    console.error('FAILURE: Prisma connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
