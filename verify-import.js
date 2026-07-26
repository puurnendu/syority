const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activityCount = await prisma.activity.count();
  const relCount = await prisma.activityRelationship.count();
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          activities: true
        }
      }
    }
  });

  console.log('--- Schedule Import Verification ---');
  console.log(`Total Activities in DB: ${activityCount}`);
  console.log(`Total Relationships in DB: ${relCount}`);
  console.log('\nProjects with Activities:');
  projects.filter(p => p._count.activities > 0).forEach(p => {
    console.log(`- Project: ${p.name} (ID: ${p.id}) | Activities: ${p._count.activities}`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
