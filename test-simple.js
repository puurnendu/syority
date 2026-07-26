require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\()
  .then(() => {
    console.log('SUCCESS: Connected without adapter');
    return prisma.\();
  })
  .catch(err => {
    console.log('ERROR:', err.message);
    console.log('CODE:', err.code);
    process.exit(1);
  });
