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
    const disciplines = await prisma.discipline.findMany({
      select: { id: true, code: true, name: true, organization_id: true }
    });
    let output = `Found ${disciplines.length} disciplines total.\n`;
    disciplines.forEach(d => output += `DISC: ${d.code} | NAME: ${d.name} | ORG: ${d.organization_id}\n`);
    fs.writeFileSync("tmp/disciplines-dump.txt", output);
    console.log("Dump written to tmp/disciplines-dump.txt");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
