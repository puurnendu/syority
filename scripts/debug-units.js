require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkData() {
  try {
    const sites = await prisma.site.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, organization_id: true }
    });
    console.log(`Found ${sites.length} sites.`);
    sites.forEach(s => console.log(`Site: ${s.name} (${s.id}) Org: ${s.organization_id}`));

    const plants = await prisma.plant.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, site_id: true, organization_id: true }
    });
    console.log(`\nFound ${plants.length} plants.`);
    plants.forEach(p => console.log(`Plant: ${p.name} (${p.id}) SiteID: ${p.site_id} Org: ${p.organization_id}`));

    const units = await prisma.unit.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, site_id: true, plant_id: true, organization_id: true }
    });
    console.log(`\nFound ${units.length} units.`);
    units.forEach(u => console.log(`Unit: ${u.name} (${u.id}) SiteID: ${u.site_id} PlantID: ${u.plant_id} Org: ${u.organization_id}`));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkData();
