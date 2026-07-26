require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Verifying Prisma Client with org_activity_number ---');
  try {
    // Try to find an activity using the new unique key (even if it doesn't exist)
    await prisma.activity.findUnique({
      where: {
        org_activity_number: {
          organization_id: '00000000-0000-0000-0000-000000000000',
          activity_number: 'TEST-123'
        }
      }
    });
    console.log('✅ Prisma client correctly recognizes org_activity_number!');
  } catch (err) {
    console.error('❌ Prisma client ERROR:', err.message);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
