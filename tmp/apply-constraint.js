require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Applying Unique Constraint via SQL ---');
  try {
    await prisma.$executeRaw`ALTER TABLE "Activity" ADD CONSTRAINT "org_activity_number" UNIQUE (organization_id, activity_number)`;
    console.log('✅ Unique constraint added successfully!');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️ Constraint already exists.');
    } else {
      console.error('❌ Failed to add constraint:', err.message);
      process.exit(1);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
