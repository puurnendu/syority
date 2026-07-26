const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
    }
  }
});

async function checkDocs() {
  const wpId = '521aa0ac-25da-490f-9f9f-9d251eef5560';
  const wp = await prisma.workpack.findUnique({
    where: { id: wpId },
    include: { documents: true }
  });

  console.log('Workpack:', wp.name);
  console.log('Documents count:', wp.documents.length);

  for (const doc of wp.documents) {
    const filePath = doc.storage_path.startsWith('/') ? doc.storage_path : path.join(process.cwd(), doc.storage_path);
    const exists = fs.existsSync(filePath);
    console.log(`Doc: ${doc.original_filename}`);
    console.log(`Path: ${filePath}`);
    console.log(`Exists: ${exists}`);
    console.log('---');
  }

  await prisma.$disconnect();
}

checkDocs();
