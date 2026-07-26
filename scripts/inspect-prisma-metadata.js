
const { Prisma } = require('@prisma/client');

// The dmmf metadata contains the models and fields the client knows about
const dmmf = Prisma.dmmf;
const model = dmmf.datamodel.models.find(m => m.name === 'WorkpackMaterialLine');

if (!model) {
  console.log('Model WorkpackMaterialLine NOT FOUND in generated DMMF.');
} else {
  console.log('Fields in WorkpackMaterialLine:');
  model.fields.forEach(f => {
    console.log(`- ${f.name} (${f.kind})`);
  });
  
  const hasItemCatalog = model.fields.some(f => f.name === 'itemCatalog');
  console.log('\nResult:', hasItemCatalog ? 'FOUND itemCatalog' : 'NOT FOUND itemCatalog');
}
