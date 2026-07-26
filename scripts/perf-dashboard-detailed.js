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
    if (!org) { return; }
    const orgId = org.id;
    console.log(`Testing with Org ID: ${orgId}`);

    const queries = [
        { name: "workpack.findMany", fn: () => prisma.workpack.findMany({ where: { organization_id: orgId, deleted_at: null }, select: { id: true } }) },
        { name: "constraintLog.count", fn: () => prisma.constraintLog.count({ where: { organization_id: orgId, deleted_at: null } }) },
        { name: "certificateInstance.count", fn: () => prisma.certificateInstance.count({ where: { organization_id: orgId, deleted_at: null } }) },
        { name: "lessonLearned.count", fn: () => prisma.lessonLearned.count({ where: { organization_id: orgId, deleted_at: null } }) },
        { name: "activity.groupBy(status)", fn: () => prisma.activity.groupBy({ by: ['status'], where: { workpack: { organization_id: orgId }, deleted_at: null }, _count: { _all: true } }) },
        { name: "activity.groupBy(workpack_id)", fn: () => prisma.activity.groupBy({ by: ['workpack_id'], where: { workpack: { organization_id: orgId }, deleted_at: null }, _avg: { progress_percent: true } }) },
    ];

    for (const q of queries) {
        const s = Date.now();
        try {
            await q.fn();
            console.log(`OK: ${q.name} took ${Date.now() - s}ms`);
        } catch (e) {
            console.log(`FAIL: ${q.name} took ${Date.now() - s}ms. Error: ${e.message}`);
        }
    }

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
