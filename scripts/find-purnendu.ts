import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Searching for "purnendu" globally ---');
  
  // 1. Check User table with partial match
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'purnendu', mode: 'insensitive' } },
        { name: { contains: 'purnendu', mode: 'insensitive' } }
      ]
    },
    include: { organization: true }
  });
  console.log('Users found:', JSON.stringify(users, null, 2));

  // 2. Check Activity table (created_by_name or similar)
  // Note: schema may not have these fields, so we use raw query
  const tables = ['Activity', 'Workpack', 'PunchItem', 'Event'];
  for (const table of tables) {
    try {
      const results = await (prisma as any).$queryRawUnsafe(`
        SELECT * FROM "${table}" 
        WHERE CAST(description AS TEXT) ILIKE '%purnendu%' 
           OR CAST(title AS TEXT) ILIKE '%purnendu%'
           OR CAST(created_by_name AS TEXT) ILIKE '%purnendu%'
        LIMIT 5
      `);
      if (results.length > 0) {
        console.log(`Found matches in ${table}:`, JSON.stringify(results, null, 2));
      }
    } catch (e) {}
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
