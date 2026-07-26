require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["error"] });
prisma.$connect()
  .then(async () => {
    console.log("SUCCESS: Connected");
    try {
      const count = await prisma.organization.count();
      console.log(`Found ${count} organizations`);
    } catch (err) {
      console.log("Query error:", err.code, err.message);
    }
    await prisma.$disconnect();
  })
  .catch(err => {
    console.log("ERROR:", err.code, err.message);
    process.exit(1);
  });