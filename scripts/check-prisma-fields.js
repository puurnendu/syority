
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const dmmf = prisma._baseDmmf || prisma._dmmf;
  
  if (!dmmf) {
    console.error('DMMF not found');
    process.exit(1);
  }

  const model = dmmf.modelMap.WorkpackMaterialLine;
  
  if (!model) {
    console.error('Model WorkpackMaterialLine not found in DMMF');
    const available = Object.keys(dmmf.modelMap);
    console.log('Available models:', available.join(', '));
    process.exit(1);
  }

  console.log('Fields in WorkpackMaterialLine:');
  model.fields.forEach((f) => {
    console.log(`- ${f.name} (${f.kind}${f.relationName ? ', relation: ' + f.relationName : ''})`);
  });
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
