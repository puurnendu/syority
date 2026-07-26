require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const orgs = await prisma.organization.count();
    const wps = await prisma.workpack.count();
    const acts = await prisma.activity.count();
    const sys = await prisma.system.count();
    const units = await prisma.unit.count();
    
    console.log(`ORGS: ${orgs}`);
    console.log(`WORKPACKS: ${wps}`);
    console.log(`ACTIVITIES: ${acts}`);
    console.log(`SYSTEMS: ${sys}`);
    console.log(`UNITS: ${units}`);

    if (sys > 0) {
        const sampleSys = await prisma.system.findMany({ take: 5 });
        sampleSys.forEach(s => console.log(`SYSTEM: ${s.id} | ORG: ${s.organization_id} | CODE: ${s.code}`));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
