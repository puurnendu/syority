const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Use Prisma's internal DMMF to see field names
  const fields = prisma._runtimeDataModel.models.Workpack.fields;
  console.log('Workpack fields:', fields.map(f => f.name).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
