require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  try {
    console.log("Testing prisma instance...");
    console.log("Has organization?", typeof prisma.organization !== "undefined");
    console.log("Has findMany?", typeof prisma.organization?.findMany === "function");
    
    if (typeof prisma.organization?.findMany === "function") {
      const result = await prisma.organization.findMany({ take: 1 });
      console.log("SUCCESS: Query worked, found", result.length, "organizations");
    } else {
      console.log("ERROR: findMany is not a function");
    }
  } catch (err) {
    console.log("ERROR:", err.code, err.message);
    if (err.meta) console.log("Meta:", JSON.stringify(err.meta, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

test();