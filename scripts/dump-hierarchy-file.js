require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const fs = require("fs");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    let output = "";
    
    const plants = await prisma.plant.findMany({
      select: { id: true, name: true, site_id: true, organization_id: true }
    });
    output += "--- PLANTS ---\n";
    plants.forEach(p => output += `PLANT: ${p.name} | ID: ${p.id} | SITE_ID: ${p.site_id} | ORG: ${p.organization_id}\n`);

    const units = await prisma.unit.findMany({
      select: { id: true, name: true, site_id: true, plant_id: true, organization_id: true }
    });
    output += "\n--- UNITS ---\n";
    units.forEach(u => output += `UNIT: ${u.name} | ID: ${u.id} | SITE_ID: ${u.site_id} | PLANT_ID: ${u.plant_id} | ORG: ${u.organization_id}\n`);

    const sites = await prisma.site.findMany({ select: { id: true, name: true, organization_id: true } });
    output += "\n--- SITES ---\n";
    sites.forEach(s => output += `SITE: ${s.name} | ID: ${s.id} | ORG: ${s.organization_id}\n`);

    fs.writeFileSync("tmp/hierarchy-dump-v2.txt", output);
    console.log("Dump written to tmp/hierarchy-dump-v2.txt");

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
