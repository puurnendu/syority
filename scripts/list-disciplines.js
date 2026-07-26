require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const disciplines = await prisma.discipline.findMany({
      select: { id: true, code: true, name: true, organization_id: true }
    });
    console.log(`Found ${disciplines.length} disciplines total.`);
    disciplines.forEach(d => console.log(`DISC: ${d.code} | NAME: ${d.name} | ORG: ${d.organization_id}`));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
