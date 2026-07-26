const { Prisma } = require('@prisma/client');

console.log(JSON.stringify(Object.keys(Prisma.ModelName), null, 2));
