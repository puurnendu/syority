const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgId = '75d1656a-1279-4672-97b1-285b7367f080'; // From earlier stats
  const since = new Date(Date.now() - 30 * 86400000);

  console.log('Testing stats queries...');

  try {
    const results = await Promise.all([
      prisma.workpack.findMany({
        where: { organization_id: orgId, deleted_at: null },
        select: {
          id: true,
          status: true,
          planned_start_date: true,
          planned_end_date: true,
          workpack_id_code: true,
          title: true,
        },
      }),
      prisma.activity.groupBy({
        by: ['status'],
        where: { organization_id: orgId, deleted_at: null },
        _count: { _all: true },
      }),
      // Testing the relation one
      prisma.workpack.findMany({
        where: { organization_id: orgId, deleted_at: null },
        select: { _count: { select: { activities: true } } },
      })
    ]);
    console.log('Main queries passed');
  } catch (e) {
    console.error('Main queries failed:', e);
  }

  // Test one that failed earlier in route.ts (line 116)
  try {
     const res = await prisma.activity.groupBy({
        by: ['workpack_id'],
        where: {
            workpack_id: { not: null },
            organization_id: orgId,
            deleted_at: null,
        },
        _avg: { progress_percent: true },
    });
    console.log('Activity groupBy workpack_id passed');
  } catch (e) {
    console.error('Activity groupBy workpack_id failed:', e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
