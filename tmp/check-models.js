const { PrismaClient } = require('@prisma/client');
try {
  const prisma = new PrismaClient();
  console.log('Available models in Prisma client:');
  const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
  console.log(keys.sort().join(', '));
  prisma.$disconnect();
} catch (e) {
  console.error("Caught error message:", e.message);
  console.error("Caught error stack:", e.stack);
}
