require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Checking for duplicate Activities ---');
  const duplicates = await prisma.$queryRaw`
    SELECT organization_id, activity_number, COUNT(*) as count
    FROM "Activity" 
    WHERE activity_number IS NOT NULL
    GROUP BY organization_id, activity_number 
    HAVING COUNT(*) > 1
  `;
  
  const serialized = duplicates.map(d => ({ 
    organization_id: d.organization_id, 
    activity_number: d.activity_number, 
    count: String(d.count) 
  }));
  
  console.log('Duplicates found:', JSON.stringify(serialized, null, 2));
  
  if (serialized.length > 0) {
    console.warn('WARNING: duplicates found. You must resolve these before applying the unique constraint.');
  } else {
    console.log('No duplicates found. Safe to apply unique constraint.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
