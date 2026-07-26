require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    
    for (const org of orgs) {
      console.log(`\nChecking ORG: ${org.name} (${org.id})`);
      
      const sites = await prisma.site.findMany({
        where: { organization_id: org.id, deleted_at: null },
        select: { id: true, name: true, code: true }
      });
      console.log(`- Sites: ${sites.length}`);
      sites.forEach(s => console.log(`  - SITE: ${s.name} (${s.id})`));

      const units = await prisma.unit.findMany({
        where: { organization_id: org.id, deleted_at: null },
        select: { id: true, name: true, code: true, site_id: true }
      });
      console.log(`- Units: ${units.length}`);
      units.forEach(u => console.log(`  - UNIT: ${u.name} (SiteID: ${u.site_id})`));
    }

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
