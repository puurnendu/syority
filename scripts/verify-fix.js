require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const org = await prisma.organization.findFirst();
    if (!org) { console.log("NO_ORG"); return; }
    
    console.log("RUNNING_FIXED_GROUP_BY...");
    const result = await prisma.activity.groupBy({
        by: ['status'],
        where: {
            organization_id: org.id,
            deleted_at: null,
        },
        _count: { _all: true },
    });
    console.log("RESULT:", JSON.stringify(result));

    console.log("RUNNING_FIXED_MATERIAL_COUNT...");
    const mCount = await prisma.workpackMaterialLine.count({
        where: { organization_id: org.id, deleted_at: null },
    });
    console.log("MATERIAL_COUNT:", mCount);

    console.log("VERIFICATION_SUCCESSFUL");

  } catch (e) {
    console.log("ERROR_MESSAGE:", e.message);
    console.log("ERROR_STACK:", e.stack);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
