require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const plants = await prisma.plant.findMany({
      select: { id: true, name: true, organization_id: true }
    });
    console.log("--- PLANTS ---");
    plants.forEach(p => console.log(`PLANT: ${p.name} | ID: ${p.id} | ORG: ${p.organization_id}`));

    const units = await prisma.unit.findMany({
      select: { id: true, name: true, organization_id: true }
    });
    console.log("\n--- UNITS ---");
    units.forEach(u => console.log(`UNIT: ${u.name} | ID: ${u.id} | ORG: ${u.organization_id}`));

    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    console.log("\n--- ORGS ---");
    orgs.forEach(o => console.log(`ORG: ${o.name} | ID: ${o.id}`));

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
