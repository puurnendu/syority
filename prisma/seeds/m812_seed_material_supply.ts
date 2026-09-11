/**
 * M8.12 — Seed Data: Material Supply Chain
 *
 * Creates realistic material supply records and constraints for testing.
 * Uses existing WorkpackMaterial / material_lines data from the EVM Demo event.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('=== M8.12 Material Supply Chain Seed ===\n');

  // Find the EVM Demo event with workpacks
  const targetEvent = await prisma.event.findFirst({
    where: { deleted_at: null, name: { contains: 'EVM Demo' } },
  });

  if (!targetEvent) {
    console.log('EVM Demo event not found. Skipping seed.');
    await pool.end();
    return;
  }

  const eventId = targetEvent.id;
  const orgId = targetEvent.organization_id;
  console.log(`Target event: ${targetEvent.name} (${eventId})`);

  // Get workpacks for this event
  const workpacks = await prisma.workpack.findMany({
    where: { event_id: eventId, deleted_at: null },
    select: { id: true, organization_id: true, site_id: true, title: true },
    take: 5,
  });
  console.log(`Workpacks: ${workpacks.length}`);

  // Get existing material lines for these workpacks
  const wpIds = workpacks.map((w) => w.id);
  const existingLines = await prisma.workpack_material_lines.findMany({
    where: { workpack_id: { in: wpIds }, deleted_at: null },
    take: 20,
  });
  console.log(`Existing material lines: ${existingLines.length}`);

  // If no material lines, create some demo ones
  if (existingLines.length === 0 && workpacks.length > 0) {
    console.log('Creating demo material lines...');
    const wp = workpacks[0];
    const demoMaterials = [
      { desc: '6" CS Pipe ASTM A106 Gr B', qty: 100, unit: 'MTR', cat: 'piping', critical: true },
      { desc: '6" 150# RTJ Weld Neck Flange', qty: 12, unit: 'EA', cat: 'piping', critical: true },
      { desc: '6" Spiral Wound Gasket 316SS/Graphite', qty: 12, unit: 'EA', cat: 'mechanical', critical: true },
      { desc: 'A193 B7 Stud Bolt 3/4" x 4-1/2"', qty: 96, unit: 'EA', cat: 'mechanical', critical: false },
      { desc: 'A194 2H Heavy Hex Nut 3/4"', qty: 192, unit: 'EA', cat: 'mechanical', critical: false },
      { desc: 'Welding Rod E7018 3.2mm', qty: 50, unit: 'KG', cat: 'consumable', critical: false },
      { desc: 'PSV Safety Valve 6" x 8" 150#', qty: 1, unit: 'EA', cat: 'valve', critical: true },
      { desc: 'Ball Valve 4" 150# CS', qty: 4, unit: 'EA', cat: 'valve', critical: true },
    ];

    for (const m of demoMaterials) {
      await prisma.workpack_material_lines.create({
        data: {
          id: randomUUID(),
          organization_id: orgId,
          workpack_id: wp.id,
          source_type: 'manual',
          description: m.desc,
          quantity_required: m.qty,
          unit_of_measure: m.unit,
          material_category: m.cat,
          is_critical: m.critical,
          updated_at: new Date(),
        },
      });
    }
    console.log(`Created ${demoMaterials.length} demo material lines`);
  }

  // Reload material lines
  const materialLines = await prisma.workpack_material_lines.findMany({
    where: { workpack_id: { in: wpIds }, deleted_at: null },
    take: 20,
  });

  if (materialLines.length === 0) {
    console.log('Still no material lines. Exiting.');
    await pool.end();
    return;
  }

  // Create supply records for the material lines
  console.log('\nCreating supply records...');
  const supplyData = [
    // Pipe — partially delivered, more in transit
    { lineIdx: 0, supplier: 'Tubacex SA', po: 'PO-2026-4501', qty: 60, recv: 60, status: 'received', eta: null, actual: '2026-08-15' },
    { lineIdx: 0, supplier: 'Tubacex SA', po: 'PO-2026-4501', qty: 40, recv: 0, status: 'in_transit', eta: '2026-09-15', actual: null },
    // Flanges — on order, delayed
    { lineIdx: 1, supplier: 'Texas Flange', po: 'PO-2026-4502', qty: 12, recv: 0, status: 'delayed', eta: '2026-09-20', actual: null },
    // Gaskets — received
    { lineIdx: 2, supplier: 'Flexitallic', po: 'PO-2026-4503', qty: 12, recv: 12, status: 'received', eta: null, actual: '2026-08-10' },
    // Bolts — received
    { lineIdx: 3, supplier: 'Infasco', po: 'PO-2026-4504', qty: 96, recv: 96, status: 'received', eta: null, actual: '2026-08-05' },
    // Nuts — received
    { lineIdx: 4, supplier: 'Infasco', po: 'PO-2026-4504', qty: 192, recv: 192, status: 'received', eta: null, actual: '2026-08-05' },
    // Welding rod — confirmed, arriving
    { lineIdx: 5, supplier: 'Lincoln Electric', po: 'PO-2026-4505', qty: 50, recv: 0, status: 'confirmed', eta: '2026-09-08', actual: null },
    // PSV — critical, no PO yet
    // (no supply record — blocked)
    // Ball valves — partial delivery
    { lineIdx: 7, supplier: 'Cameron Valves', po: 'PO-2026-4506', qty: 2, recv: 2, status: 'received', eta: null, actual: '2026-08-20' },
    { lineIdx: 7, supplier: 'Cameron Valves', po: 'PO-2026-4507', qty: 2, recv: 0, status: 'pending', eta: '2026-09-25', actual: null },
  ];

  let created = 0;
  for (const sd of supplyData) {
    if (sd.lineIdx >= materialLines.length) continue;
    const ml = materialLines[sd.lineIdx];
    await prisma.materialSupplyRecord.create({
      data: {
        organization_id: orgId,
        material_line_id: ml.id,
        supplier_name: sd.supplier,
        po_number: sd.po,
        quantity_ordered: sd.qty,
        quantity_received: sd.recv,
        expected_delivery: sd.eta ? new Date(sd.eta) : null,
        actual_delivery: sd.actual ? new Date(sd.actual) : null,
        delivery_status: sd.status,
        unit_cost: null,
      },
    });
    created++;

    // Update material line aggregates
    const records = await prisma.materialSupplyRecord.findMany({
      where: { material_line_id: ml.id, delivery_status: { not: 'cancelled' } },
    });
    const totalOrdered = records.reduce((s, r) => s + r.quantity_ordered, 0);
    const totalReceived = records.reduce((s, r) => s + r.quantity_received, 0);
    const pendingEtas = records
      .filter((r) => r.delivery_status !== 'received' && r.delivery_status !== 'cancelled')
      .map((r) => r.expected_delivery)
      .filter((d): d is Date => d !== null);
    const latestEta = pendingEtas.length > 0 ? pendingEtas.sort((a, b) => b.getTime() - a.getTime())[0] : null;

    const shortfall = Math.max(0, ml.quantity_required - totalReceived);
    let readiness = 'not_assessed';
    if (shortfall <= 0) readiness = 'ready';
    else if (totalReceived > 0 && totalReceived < ml.quantity_required) readiness = latestEta ? 'partial' : 'blocked';
    else if (totalOrdered >= shortfall && latestEta) readiness = 'not_ready';
    else if (totalOrdered > 0) readiness = 'not_ready';
    else readiness = 'blocked';

    await prisma.workpack_material_lines.update({
      where: { id: ml.id },
      data: {
        quantity_available: totalReceived,
        quantity_on_order: totalOrdered,
        expected_eta: latestEta,
        supplier_name: sd.supplier,
        po_number: sd.po,
        material_readiness: readiness,
      },
    });
  }
  console.log(`Created ${created} supply records`);

  // Update the PSV line (index 6) as blocked — no supply records
  if (materialLines.length > 6) {
    await prisma.workpack_material_lines.update({
      where: { id: materialLines[6].id },
      data: { material_readiness: 'blocked' },
    });
  }

  // Verify
  const totalSupply = await prisma.materialSupplyRecord.count({ where: { organization_id: orgId } });
  const lineStatuses = await prisma.workpack_material_lines.findMany({
    where: { workpack_id: { in: wpIds }, deleted_at: null },
    select: { description: true, material_readiness: true, quantity_required: true, quantity_available: true, quantity_on_order: true, is_critical: true },
  });

  console.log(`\nTotal supply records: ${totalSupply}`);
  console.log('\nMaterial readiness status:');
  for (const l of lineStatuses) {
    console.log(`  [${l.material_readiness.padEnd(12)}] ${l.is_critical ? '🔴' : '⚪'} ${l.description} (req=${l.quantity_required} avail=${l.quantity_available} order=${l.quantity_on_order})`);
  }

  console.log('\n=== M8.12 Seed Complete ===');
  await pool.end();
}

seed().catch((e) => {
  console.error('Seed error:', e);
  process.exit(1);
});
