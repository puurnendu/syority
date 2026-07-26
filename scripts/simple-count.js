require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.unit.count();
    console.log(`TOTAL_UNITS_COUNT: ${count}`);
    
    if (count > 0) {
      const units = await prisma.unit.findMany();
      units.forEach(u => console.log(`UNIT_NAME: ${u.name} | DELETED: ${u.deleted_at}`));
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
