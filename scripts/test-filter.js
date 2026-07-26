require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const orgId = "050e19a7-8c49-45f3-b03b-b46cfedde227"; // YARA
    const units = await prisma.unit.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true, name: true, code: true, site_id: true },
      orderBy: { name: 'asc' },
    });

    console.log(`Fetched ${units.length} units for org ${orgId}`);
    units.forEach(u => {
      console.log(`Unit: ${u.name} | SiteID: ${u.site_id} | Type: ${typeof u.site_id}`);
    });

    const selectedSiteIdFromScreenshot = "d27d8c98-6193-427d-b3b0-fb7bc2568898"; // Babrala
    console.log(`\nFiltering for SiteID: ${selectedSiteIdFromScreenshot} | Type: ${typeof selectedSiteIdFromScreenshot}`);
    
    const filtered = units.filter(u => u.site_id === selectedSiteIdFromScreenshot);
    console.log(`Filtered units count: ${filtered.length}`);

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
