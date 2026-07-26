import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating loose activities to "imported" status...');

  const result = await prisma.activity.updateMany({
    where: {
      workpack_id: null,
      schedule_source: 'workpack', // Default value after schema update
    },
    data: {
      schedule_source: 'imported',
    },
  });

  console.log(`Successfully migrated ${result.count} activities to "imported".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
