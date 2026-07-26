const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocs() {
  const wpId = '521aa0ac-25da-490f-9f9f-9d251eef5560';
  const wp = await prisma.workpack.findUnique({
    where: { id: wpId },
    include: { documents: true }
  });

  if (!wp) {
    console.log('Workpack not found');
    return;
  }

  console.log('Documents for WP:', wp.id);
  wp.documents.forEach(doc => {
    console.log(`- ${doc.original_filename}: ${doc.storage_path}`);
  });

  await prisma.$disconnect();
}

checkDocs();
