require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Get the first organization for testing
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.log("No organizations found.");
        return;
    }
    const orgId = org.id;
    console.log(`Testing with Org ID: ${orgId} (${org.name})`);

    const start = Date.now();

    console.log("1. Fetching system IDs...");
    const allSys = await prisma.system.findMany({
        where: { organization_id: orgId, deleted_at: null },
        select: { id: true },
    });
    const systemIds = allSys.map((s) => s.id);
    console.log(`Found ${systemIds.length} systems. Time: ${Date.now() - start}ms`);

    // We skip the computePlanningProgressForSystem loop for now to see if the Promise.all is the issue
    // Or let's just do it to be thorough
    /*
    console.log("2. Running system progress loop...");
    for (const sid of systemIds) {
        // Mocking computePlanningProgressForSystem logic
        await prisma.system.findUnique({ where: { id: sid } });
    }
    console.log(`Loop finished. Time: ${Date.now() - start}ms`);
    */

    console.log("3. Starting main Promise.all...");
    const pStart = Date.now();
    await Promise.all([
        prisma.workpack.findMany({
            where: { organization_id: orgId, deleted_at: null },
            select: { id: true, status: true, planned_start_date: true, planned_end_date: true, workpack_id_code: true, title: true },
        }),
        prisma.constraintLog.count({
            where: { organization_id: orgId, status: { in: ['open', 'in_progress'] }, severity: { in: ['critical', 'high'] }, is_in_central_register: true, deleted_at: null },
        }),
        prisma.certificateInstance.count({
            where: { organization_id: orgId, status: { notIn: ['signed', 'rejected'] }, deleted_at: null },
        }),
        prisma.lessonLearned.count({
            where: { organization_id: orgId, status: 'published', is_in_central_register: true, deleted_at: null },
        }),
        prisma.activity.groupBy({
            by: ['status'],
            where: { workpack: { organization_id: orgId }, deleted_at: null },
            _count: { _all: true },
        }),
        prisma.workpack.groupBy({
            by: ['status'],
            where: { organization_id: orgId, deleted_at: null },
            _count: { _all: true },
        }),
        prisma.activity.groupBy({
            by: ['workpack_id'],
            where: { workpack_id: { not: null }, workpack: { organization_id: orgId, deleted_at: null }, deleted_at: null },
            _avg: { progress_percent: true },
        }),
        prisma.workpackMaterialLine.count({
            where: { workpack: { organization_id: orgId, deleted_at: null }, deleted_at: null },
        }),
        prisma.jointIntegrityItem.count({
            where: { workpack: { organization_id: orgId, deleted_at: null }, deleted_at: null },
        }),
    ]);
    console.log(`Promise.all finished. Time: ${Date.now() - pStart}ms`);
    console.log(`Total time: ${Date.now() - start}ms`);

  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
