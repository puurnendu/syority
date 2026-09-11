/**
 * M8.5 — Activity Knowledge Bank Seed
 *
 * Seeds 102 canonical PLATFORM-scope ActivityLibrary entries
 * and 9 Quantity UDF definitions from M8.4.9 remediation data.
 *
 * Usage: npx ts-node prisma/seeds/knowledge-bank.ts
 * Or:    node -e "require('./prisma/seeds/knowledge-bank')"
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── Phase map: family code → execution phase ────────────────────────────────
const FAMILY_PHASE: Record<string, string> = {
  PREP: 'PRE_SHUTDOWN',
  ISO: 'PRE_SHUTDOWN',
  DISMANTLE: 'EXECUTION',
  CLEAN: 'EXECUTION',
  INSP: 'EXECUTION',
  NDT: 'EXECUTION',
  REPAIR: 'EXECUTION',
  SURFACE: 'EXECUTION',
  ASSY: 'POST_EXECUTION',
  TEST: 'POST_EXECUTION',
  QC: 'POST_EXECUTION',
  HP: 'EXECUTION',
  LOGISTICS: 'EXECUTION',
  ADMIN: 'ALL',
};

// ── Quantity UDF definitions ────────────────────────────────────────────────
const QUANTITY_UDFS = [
  { code: 'WELD_QTY', name: 'Welding Quantity', unit: 'inch-dia', exportable: true },
  { code: 'INSUL_AREA', name: 'Insulation Area', unit: 'm²', exportable: true },
  { code: 'BLIND_COUNT', name: 'Blind Count', unit: 'ea', exportable: true },
  { code: 'PAINT_AREA', name: 'Painting Area', unit: 'm²', exportable: true },
  { code: 'HJ_TUBE_COUNT', name: 'Hydrojetting Tubes', unit: 'ea', exportable: false },
  { code: 'BOLT_TORQUE_COUNT', name: 'Bolt Torque Count', unit: 'ea', exportable: false },
  { code: 'NDT_JOINT_COUNT', name: 'NDT Joint Count', unit: 'ea', exportable: true },
  { code: 'SCAFFOLD_AREA', name: 'Scaffolding Area', unit: 'm²', exportable: false },
  { code: 'TEST_PRESSURE', name: 'Test Pressure', unit: 'kg/cm²', exportable: false },
];

async function seedKnowledgeBank() {
  console.log('=== M8.5 — Knowledge Bank Seed ===\n');

  // Load M8.4.9 knowledge bank JSON
  const kbPath = path.resolve(__dirname, '../../../HMEL-Workpack/ANALYSIS/M849_REMEDIATION/M849_ACTIVITY_KNOWLEDGE_BANK.json');
  if (!fs.existsSync(kbPath)) {
    // Fallback: try relative to CWD
    const altPath = path.resolve(process.cwd(), '../HMEL-Workpack/ANALYSIS/M849_REMEDIATION/M849_ACTIVITY_KNOWLEDGE_BANK.json');
    if (!fs.existsSync(altPath)) {
      console.error('Knowledge bank JSON not found at:', kbPath);
      console.error('Also tried:', altPath);
      process.exit(1);
    }
  }

  const actualPath = fs.existsSync(kbPath)
    ? kbPath
    : path.resolve(process.cwd(), '../HMEL-Workpack/ANALYSIS/M849_REMEDIATION/M849_ACTIVITY_KNOWLEDGE_BANK.json');

  const kb = JSON.parse(fs.readFileSync(actualPath, 'utf8'));

  // 1. Seed PLATFORM-scope ActivityLibrary entries
  console.log(`Seeding ${kb.activities.length} PLATFORM activity codes...`);

  let created = 0;
  let skipped = 0;

  for (const act of kb.activities) {
    const familyPhase = FAMILY_PHASE[act.family] || 'EXECUTION';

    // Check if already exists (PLATFORM scope)
    const existing = await prisma.activityLibrary.findFirst({
      where: {
        activity_code: act.code,
        library_scope: 'PLATFORM',
        organization_id: null,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.activityLibrary.create({
      data: {
        id: randomUUID(),
        organization_id: null,
        name: act.name,
        description: `${act.name} — Evidence: ${act.evidence} occurrences, Confidence: ${act.confidence}`,
        activity_code: act.code,
        work_category: act.family,
        phase: familyPhase,
        level_code: act.code,
        duration_hours: act.durMed || null,
        hold_point_type: act.holdPoint ? 'HOLD' : null,
        is_active: true,
        library_scope: 'PLATFORM',
        updated_at: new Date(),
      },
    });
    created++;
  }

  console.log(`  ✅ Created: ${created}, Skipped (already exist): ${skipped}`);

  // 2. Verify count
  const totalPlatform = await prisma.activityLibrary.count({
    where: { library_scope: 'PLATFORM', organization_id: null },
  });
  console.log(`  Total PLATFORM activity codes: ${totalPlatform}`);

  // 3. Seed Quantity UDF definitions
  // These need an org_id due to the unique constraint — we'll create them per-org
  // For now, log them as reference. Actual org-level seeding happens during tenant provisioning.
  console.log(`\n${QUANTITY_UDFS.length} Quantity UDF definitions available for tenant provisioning:`);
  for (const udf of QUANTITY_UDFS) {
    console.log(`  ${udf.code}: ${udf.name} (${udf.unit}) exportable=${udf.exportable}`);
  }

  console.log('\n=== Knowledge Bank Seed Complete ===');
  console.log(`Activity codes: ${totalPlatform}`);
  console.log('UDF templates: 9 (seed during tenant provisioning)');
}

// Export for programmatic use
export { seedKnowledgeBank, QUANTITY_UDFS };

// Run if called directly
if (require.main === module) {
  seedKnowledgeBank()
    .catch((e) => {
      console.error('Seed failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
