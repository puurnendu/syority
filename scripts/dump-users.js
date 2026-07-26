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
    const users = await prisma.user.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, email: true, organization_id: true }
    });
    let output = "";
    users.forEach(u => output += `USER: ${u.name} (${u.email}) | ID: ${u.id} | ORG_ID: ${u.organization_id}\n`);
    fs.writeFileSync("tmp/users-dump.txt", output);
    console.log("Dump written to tmp/users-dump.txt");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
run();
