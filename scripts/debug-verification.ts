import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Checking Reporting Tables ---');
  const tables = ['ReportTemplate', 'ScheduledDelivery', 'DeliveryLog'];
  for (const table of tables) {
    try {
      await (prisma as any).$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
      console.log(`✅ Table "${table}" exists in DB.`);
    } catch (e: any) {
      console.log(`❌ Table "${table}" DOES NOT exist or error:`, e.message);
    }
  }

  console.log('\n--- Searching for Users in Yara Orgs ---');
  try {
    const yaraUsers = await prisma.user.findMany({
      where: {
        organization: {
          OR: [
            { slug: 'yara-fertilisers' },
            { slug: 'yara-pilbara' },
            { name: { contains: 'Yara' } }
          ]
        }
      },
      include: { organization: { select: { name: true, slug: true } } }
    });
    console.log(`Found ${yaraUsers.length} users:`);
    console.log(JSON.stringify(yaraUsers, null, 2));
  } catch (e: any) {
    console.error('Failed to list Yara users:', e.message);
  }

  console.log('\n--- Checking for purnendu@syority.com (Global) ---');
  try {
    const purnendu = await prisma.user.findFirst({
        where: { email: 'purnendu@syority.com' },
        include: { organization: true }
    });
    if (purnendu) {
        console.log('✅ Found purnendu@syority.com:', JSON.stringify(purnendu, null, 2));
    } else {
        console.log('❌ purnendu@syority.com NOT found.');
    }
  } catch (e: any) {
    console.error('Failed to find purnendu:', e.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
