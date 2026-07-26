const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating loose activities to "imported" status...');

  const result = await prisma.activity.updateMany({
    where: {
      workpack_id: null,
      // After schema push, these will have the default "workpack" or be null if they existed before
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
