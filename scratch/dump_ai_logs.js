const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
    }
  }
});

async function dumpLogs() {
  const logs = await prisma.aiLog.findMany({
    where: { 
      operation: { contains: 'Joint' } 
    },
    orderBy: { created_at: 'desc' },
    take: 5
  });

  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
}

dumpLogs().catch(err => {
  console.error(err);
  process.exit(1);
});
