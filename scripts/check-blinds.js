const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBlinds() {
  try {
    const blinds = await prisma.blind.findMany({
      orderBy: { created_at: 'desc' },
      take: 5
    });
    console.log('Recent Blinds in DB:', JSON.stringify(blinds, null, 2));
    
    // Check if any blinds exist for the last modified workpack
    const lastWP = await prisma.workpack.findFirst({
        orderBy: { updated_at: 'desc' }
    });
    if (lastWP) {
        const wpBlinds = await prisma.blind.findMany({
            where: { workpack_id: lastWP.id }
        });
        console.log(`Blinds for latest WP (${lastWP.id}):`, wpBlinds.length);
    }

    const count = await prisma.blind.count();
    console.log('Total Blinds count:', count);
  } catch (e) {
    console.error('Error during DB check:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkBlinds();
