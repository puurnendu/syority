const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wp = await prisma.workpack.findFirst({
    where: { id: '521aa0ac-25da-490f-9f9f-9d251eef5560' },
    select: { equipment_technical_data: true }
  });
  console.dir(wp.equipment_technical_data, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
