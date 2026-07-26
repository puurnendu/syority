require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

async function checkUnitsDirectly() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const rawUnits = await prisma.unit.findMany({
      select: { id: true, name: true, deleted_at: true, organization_id: true }
    });
    console.log(`Found ${rawUnits.length} units in total.`);
    console.table(rawUnits);

    const rawPlants = await prisma.plant.findMany({
      select: { id: true, name: true, deleted_at: true, organization_id: true }
    });
    console.log(`\nFound ${rawPlants.length} plants in total.`);
    console.table(rawPlants);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkUnitsDirectly();
