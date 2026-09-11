const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/syority' });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const sql = fs.readFileSync('prisma/migrations/20260829000000_add_resource_planning/migration.sql', 'utf8');
  await prisma.$executeRawUnsafe(sql);
  console.log('Migration applied successfully');

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
