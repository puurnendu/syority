const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('Verifying Prisma relations for Activity model...');

  try {
    // 1. Test include materials
    console.log('Test 1: Fetching activities with materials...');
    const activitiesWithMaterials = await prisma.activity.findMany({
      take: 1,
      include: {
        materials: {
          where: { material_category: 'electrical' }
        }
      }
    });
    console.log('Test 1 Success: materials relation is recognized.');

    // 2. Test qa_clearances where clause
    console.log('Test 2: Counting activities with qa_clearances: none...');
    const count = await prisma.activity.count({
      where: {
        hold_point_type: { in: ['H', 'W'] },
        qa_clearances: { none: {} }
      }
    });
    console.log(`Test 2 Success: qa_clearances relation is recognized. Count: ${count}`);

    console.log('\nAll Prisma relation tests passed successfully!');
  } catch (err) {
    console.error('\nTest Failed!');
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
