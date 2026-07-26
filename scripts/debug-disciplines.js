require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const DEFAULT_DISCIPLINES = [
    { code: 'MECH', name: 'Mechanical', color: '#3B82F6' },
    { code: 'ELEC', name: 'Electrical', color: '#F59E0B' },
    { code: 'INST', name: 'Instrumentation', color: '#8B5CF6' },
    { code: 'CIVIL', name: 'Civil', color: '#10B981' },
    { code: 'PIPING', name: 'Piping', color: '#EF4444' },
    { code: 'STRUCT', name: 'Structural', color: '#6B7280' },
];

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log("No organization found");
      return;
    }
    const organizationId = org.id;
    console.log(`Testing for Org: ${org.name} (${organizationId})`);

    for (const d of DEFAULT_DISCIPLINES) {
        console.log(`Upserting ${d.code}...`);
        await prisma.discipline.upsert({
            where: {
                organization_id_code: { organization_id: organizationId, code: d.code },
            },
            update: { color: d.color, name: d.name, is_active: true },
            create: {
                organization_id: organizationId,
                code: d.code,
                name: d.name,
                color: d.color,
                is_active: true,
            },
        });
    }
    console.log("SUCCESS");
  } catch (err) {
    console.error("ERROR TYPE:", err.constructor.name);
    console.error("ERROR CODE:", err.code);
    console.error("ERROR MESSAGE:", err.message);
    if (err.meta) console.error("META:", JSON.stringify(err.meta, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
