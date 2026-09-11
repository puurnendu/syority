import { prisma, disconnect } from './seed-client';
import { randomUUID } from 'crypto';

const LOOKUP_TABLE = [
  ['1/2"', '150#', 'RF', 'SWG Gasket 1/2" 150# RF', 'B7 Stud M12×70', 4, 70, '2H Nut M12'],
  ['1/2"', '#300', 'RF', 'SWG Gasket 1/2" #300 RF', 'B7 Stud M16×80', 4, 80, '2H Nut M16'],
  ['1/2"', '#600', 'RF', 'SWG Gasket 1/2" #600 RF', 'B7 Stud M16×90', 4, 90, '2H Nut M16'],
  ['3/4"', '150#', 'RF', 'SWG Gasket 3/4" 150# RF', 'B7 Stud M12×75', 4, 75, '2H Nut M12'],
  ['3/4"', '#300', 'RF', 'SWG Gasket 3/4" #300 RF', 'B7 Stud M16×85', 4, 85, '2H Nut M16'],
  ['3/4"', '#600', 'RF', 'SWG Gasket 3/4" #600 RF', 'B7 Stud M16×95', 4, 95, '2H Nut M16'],
  ['1"', '150#', 'RF', 'SWG Gasket 1" 150# RF', 'B7 Stud M16×85', 4, 85, '2H Nut M16'],
  ['1"', '#300', 'RF', 'SWG Gasket 1" #300 RF', 'B7 Stud M16×95', 4, 95, '2H Nut M16'],
  ['1"', '#600', 'RF', 'SWG Gasket 1" #600 RF', 'B7 Stud M20×100', 4, 100, '2H Nut M20'],
  ['1.5"', '150#', 'RF', 'SWG Gasket 1.5" 150# RF', 'B7 Stud M16×90', 4, 90, '2H Nut M16'],
  ['1.5"', '#300', 'RF', 'SWG Gasket 1.5" #300 RF', 'B7 Stud M20×100', 4, 100, '2H Nut M20'],
  ['1.5"', '#600', 'RF', 'SWG Gasket 1.5" #600 RF', 'B7 Stud M20×110', 4, 110, '2H Nut M20'],
  ['2"', '150#', 'RF', 'SWG Gasket 2" 150# RF', 'B7 Stud M16×90', 8, 90, '2H Nut M16'],
  ['2"', '#300', 'RF', 'SWG Gasket 2" #300 RF', 'B7 Stud M20×100', 8, 100, '2H Nut M20'],
  ['2"', '#600', 'RF', 'SWG Gasket 2" #600 RF', 'B7 Stud M20×120', 8, 120, '2H Nut M20'],
  ['2"', '#900', 'RF', 'SWG Gasket 2" #900 RF', 'B7 Stud M24×130', 8, 130, '2H Nut M24'],
  ['2"', '150#', 'RTJ', 'Ring Gasket 2" 150# RTJ', 'B7 Stud M16×100', 8, 100, '2H Nut M16'],
  ['2"', '#300', 'RTJ', 'Ring Gasket 2" #300 RTJ', 'B7 Stud M20×110', 8, 110, '2H Nut M20'],
  ['2"', '#600', 'RTJ', 'Ring Gasket 2" #600 RTJ', 'B7 Stud M20×130', 8, 130, '2H Nut M20'],
  ['3"', '150#', 'RF', 'SWG Gasket 3" 150# RF', 'B7 Stud M16×95', 8, 95, '2H Nut M16'],
  ['3"', '#300', 'RF', 'SWG Gasket 3" #300 RF', 'B7 Stud M20×110', 8, 110, '2H Nut M20'],
  ['3"', '#600', 'RF', 'SWG Gasket 3" #600 RF', 'B7 Stud M24×130', 8, 130, '2H Nut M24'],
  ['3"', '#900', 'RF', 'SWG Gasket 3" #900 RF', 'B7 Stud M24×140', 8, 140, '2H Nut M24'],
  ['3"', '150#', 'RTJ', 'Ring Gasket 3" 150# RTJ', 'B7 Stud M16×105', 8, 105, '2H Nut M16'],
  ['3"', '#300', 'RTJ', 'Ring Gasket 3" #300 RTJ', 'B7 Stud M20×120', 8, 120, '2H Nut M20'],
  ['4"', '150#', 'RF', 'SWG Gasket 4" 150# RF', 'B7 Stud M20×110', 8, 110, '2H Nut M20'],
  ['4"', '#300', 'RF', 'SWG Gasket 4" #300 RF', 'B7 Stud M20×120', 8, 120, '2H Nut M20'],
  ['4"', '#600', 'RF', 'SWG Gasket 4" #600 RF', 'B7 Stud M24×140', 8, 140, '2H Nut M24'],
  ['4"', '#900', 'RF', 'SWG Gasket 4" #900 RF', 'B7 Stud M30×160', 8, 160, '2H Nut M30'],
  ['4"', '150#', 'RTJ', 'Ring Gasket 4" 150# RTJ', 'B7 Stud M20×120', 8, 120, '2H Nut M20'],
  ['4"', '#300', 'RTJ', 'Ring Gasket 4" #300 RTJ', 'B7 Stud M24×140', 8, 140, '2H Nut M24'],
  ['4"', '#600', 'RTJ', 'Ring Gasket 4" #600 RTJ', 'B7 Stud M24×160', 8, 160, '2H Nut M24'],
  ['6"', '150#', 'RF', 'SWG Gasket 6" 150# RF', 'B7 Stud M20×120', 12, 120, '2H Nut M20'],
  ['6"', '#300', 'RF', 'SWG Gasket 6" #300 RF', 'B7 Stud M24×140', 12, 140, '2H Nut M24'],
  ['6"', '#600', 'RF', 'SWG Gasket 6" #600 RF', 'B7 Stud M30×170', 12, 170, '2H Nut M30'],
  ['6"', '#900', 'RF', 'SWG Gasket 6" #900 RF', 'B7 Stud M36×195', 12, 195, '2H Nut M36'],
  ['6"', '150#', 'RTJ', 'Ring Gasket 6" 150# RTJ', 'B7 Stud M20×135', 12, 135, '2H Nut M20'],
  ['6"', '#300', 'RTJ', 'Ring Gasket 6" #300 RTJ', 'B7 Stud M24×155', 12, 155, '2H Nut M24'],
  ['6"', '#600', 'RTJ', 'Ring Gasket 6" #600 RTJ', 'B7 Stud M30×185', 12, 185, '2H Nut M30'],
  ['8"', '150#', 'RF', 'SWG Gasket 8" 150# RF', 'B7 Stud M20×125', 12, 125, '2H Nut M20'],
  ['8"', '#300', 'RF', 'SWG Gasket 8" #300 RF', 'B7 Stud M24×150', 12, 150, '2H Nut M24'],
  ['8"', '#600', 'RF', 'SWG Gasket 8" #600 RF', 'B7 Stud M30×180', 12, 180, '2H Nut M30'],
  ['8"', '#900', 'RF', 'SWG Gasket 8" #900 RF', 'B7 Stud M36×210', 12, 210, '2H Nut M36'],
  ['8"', '150#', 'RTJ', 'Ring Gasket 8" 150# RTJ', 'B7 Stud M20×140', 12, 140, '2H Nut M20'],
  ['8"', '#300', 'RTJ', 'Ring Gasket 8" #300 RTJ', 'B7 Stud M24×165', 12, 165, '2H Nut M24'],
  ['8"', '#600', 'RTJ', 'Ring Gasket 8" #600 RTJ', 'B7 Stud M30×200', 12, 200, '2H Nut M30'],
  ['10"', '150#', 'RF', 'SWG Gasket 10" 150# RF', 'B7 Stud M24×135', 16, 135, '2H Nut M24'],
  ['10"', '#300', 'RF', 'SWG Gasket 10" #300 RF', 'B7 Stud M30×165', 16, 165, '2H Nut M30'],
  ['10"', '#600', 'RF', 'SWG Gasket 10" #600 RF', 'B7 Stud M36×200', 16, 200, '2H Nut M30'],
  ['10"', '150#', 'RTJ', 'Ring Gasket 10" 150# RTJ', 'B7 Stud M24×150', 16, 150, '2H Nut M24'],
  ['10"', '#300', 'RTJ', 'Ring Gasket 10" #300 RTJ', 'B7 Stud M30×180', 16, 180, '2H Nut M30'],
  ['12"', '150#', 'RF', 'SWG Gasket 12" 150# RF', 'B7 Stud M24×145', 16, 145, '2H Nut M24'],
  ['12"', '#300', 'RF', 'SWG Gasket 12" #300 RF', 'B7 Stud M30×175', 20, 175, '2H Nut M30'],
  ['12"', '#600', 'RF', 'SWG Gasket 12" #600 RF', 'B7 Stud M36×215', 20, 215, '2H Nut M36'],
  ['12"', '150#', 'RTJ', 'Ring Gasket 12" 150# RTJ', 'B7 Stud M24×160', 16, 160, '2H Nut M24'],
  ['12"', '#300', 'RTJ', 'Ring Gasket 12" #300 RTJ', 'B7 Stud M30×195', 20, 195, '2H Nut M30'],
  ['16"', '150#', 'RF', 'SWG Gasket 16" 150# RF', 'B7 Stud M30×160', 20, 160, '2H Nut M30'],
  ['16"', '#300', 'RF', 'SWG Gasket 16" #300 RF', 'B7 Stud M36×195', 20, 195, '2H Nut M36'],
  ['16"', '#600', 'RF', 'SWG Gasket 16" #600 RF', 'B7 Stud M42×240', 20, 240, '2H Nut M42'],
  ['20"', '150#', 'RF', 'SWG Gasket 20" 150# RF', 'B7 Stud M30×175', 24, 175, '2H Nut M30'],
  ['20"', '#300', 'RF', 'SWG Gasket 20" #300 RF', 'B7 Stud M36×215', 24, 215, '2H Nut M36'],
  ['24"', '150#', 'RF', 'SWG Gasket 24" 150# RF', 'B7 Stud M30×185', 24, 185, '2H Nut M30'],
  ['24"', '#300', 'RF', 'SWG Gasket 24" #300 RF', 'B7 Stud M36×225', 24, 225, '2H Nut M36'],
] as const;

async function main() {
  const demoOrg = await prisma.organization.findFirst({
    where: { slug: 'auriana-demo' },
    select: { id: true },
  });

  if (!demoOrg) {
    console.log('No demo org found — skipping lookup seed');
    return;
  }

  let count = 0;
  for (const [size, cls, type, gasketDesc, boltDesc, boltCount, boltMm, nutDesc] of LOOKUP_TABLE) {
    await prisma.gasket_bolt_lookup.upsert({
      where: {
        organization_id_pipe_size_pressure_class_flange_type: {
          organization_id: demoOrg.id,
          pipe_size: size,
          pressure_class: cls,
          flange_type: type,
        },
      },
      update: {
        gasket_description: gasketDesc,
        bolt_description: boltDesc,
        bolt_count: boltCount,
        bolt_length_mm: boltMm,
        nut_description: nutDesc,
      },
      create: {
        id: randomUUID(),
        organization_id: demoOrg.id,
        pipe_size: size,
        pressure_class: cls,
        flange_type: type,
        gasket_description: gasketDesc,
        bolt_description: boltDesc,
        bolt_count: boltCount,
        bolt_length_mm: boltMm,
        nut_description: nutDesc,
        updated_at: new Date(),
      },
    });
    count++;
  }

  console.log(`✅ ${count} gasket-bolt lookup rows seeded`);
  console.log('Sizes: 1/2" to 24" | Classes: 150# to #900');
  console.log('Types: RF and RTJ');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnect());
