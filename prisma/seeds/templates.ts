/**
 * M8.5 — Template Seed
 *
 * Seeds 11 P0 templates from M8.4.9 remediation data:
 * - 11 TemplateFamily entries
 * - 11 workpack_templates (PLATFORM/PUBLISHED)
 * - 155 workpack_template_activities
 * - ~150 workpack_template_logic_links
 *
 * Usage: npx ts-node prisma/seeds/templates.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function seedTemplates() {
  console.log('=== M8.5 — Template Seed ===\n');

  // Load M8.4.9 template seed JSON
  const seedPath = path.resolve(__dirname, '../../../HMEL-Workpack/ANALYSIS/M849_REMEDIATION/M849_TEMPLATE_SEED.json');
  const altPath = path.resolve(process.cwd(), '../HMEL-Workpack/ANALYSIS/M849_REMEDIATION/M849_TEMPLATE_SEED.json');
  const actualPath = fs.existsSync(seedPath) ? seedPath : altPath;

  if (!fs.existsSync(actualPath)) {
    console.error('Template seed JSON not found');
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
  console.log(`Found ${seed.templates.length} templates to seed\n`);

  let familiesCreated = 0;
  let templatesCreated = 0;
  let activitiesCreated = 0;
  let linksCreated = 0;
  let skipped = 0;

  for (const tpl of seed.templates) {
    const familyId = randomUUID();
    const templateId = randomUUID();

    // Check if template already exists (by code in name)
    const existing = await prisma.workpack_templates.findFirst({
      where: {
        name: { contains: tpl.code },
        library_scope: 'PLATFORM',
        organization_id: null,
      },
    });

    if (existing) {
      console.log(`  ⏭ ${tpl.code} already exists, skipping`);
      skipped++;
      continue;
    }

    // 1. Create TemplateFamily
    await prisma.templateFamily.create({
      data: {
        id: familyId,
        organization_id: null,
        name: tpl.name,
        code: tpl.code,
        description: `${tpl.equipment} — ${tpl.name}`,
        equipment_type: tpl.equipment,
        sort_order: familiesCreated,
        is_active: true,
        created_by: SYSTEM_USER_ID,
        updated_at: new Date(),
      },
    });
    familiesCreated++;

    // 2. Create workpack_template
    await prisma.workpack_templates.create({
      data: {
        id: templateId,
        organization_id: null,
        template_family_id: familyId,
        revision: 1,
        version_label: '1.0',
        library_scope: 'PLATFORM',
        lifecycle_status: 'PUBLISHED',
        name: `${tpl.code} — ${tpl.name}`,
        category: tpl.jobType || 'Inspection',
        equipment_type: tpl.equipment,
        job_type: tpl.jobType || 'Inspection',
        description: `SYORITY canonical template for ${tpl.equipment} ${tpl.jobType || 'maintenance'}. ${tpl.activityCount} activities.`,
        planning_json: {},
        resources_json: [],
        materials_json: [],
        safety_json: {},
        qaqc_json: {},
        references_json: [],
        ai_metadata_json: { source: 'M8.4.9', corpus: 'HMEL', confidence: 'FACT' },
        is_system: true,
        is_active: true,
        created_by: SYSTEM_USER_ID,
        published_at: new Date(),
        updated_at: new Date(),
      },
    });
    templatesCreated++;

    // 3. Create template activities
    for (const act of tpl.activities) {
      await prisma.workpack_template_activities.create({
        data: {
          id: randomUUID(),
          organization_id: SYSTEM_USER_ID, // Required non-null in schema
          template_id: templateId,
          sequence_number: act.sequence,
          activity_code: act.activityCode,
          description: act.activityName,
          duration_hours: act.durationHours || null,
          is_optional: act.conditionality !== 'MANDATORY',
          hold_point_type: act.holdPoint || null,
          conditionality: act.conditionality || 'MANDATORY',
          condition_expression: act.condition || null,
          udf_defaults: Prisma.JsonNull,
          predecessor_sequences: (act.predecessors || []).map((p: any) => p.seq),
          updated_at: new Date(),
        },
      });
      activitiesCreated++;
    }

    // 4. Create logic links from predecessor data
    for (const act of tpl.activities) {
      for (const pred of act.predecessors || []) {
        await prisma.workpack_template_logic_links.create({
          data: {
            id: randomUUID(),
            organization_id: SYSTEM_USER_ID,
            template_id: templateId,
            predecessor_seq: pred.seq,
            successor_seq: act.sequence,
            link_type: pred.type || 'FS',
            lag_hours: pred.lag || 0,
            updated_at: new Date(),
          },
        });
        linksCreated++;
      }
    }

    console.log(`  ✅ ${tpl.code}: ${tpl.activities.length} activities, ${tpl.activities.reduce((s: number, a: any) => s + (a.predecessors?.length || 0), 0)} links`);
  }

  console.log('\n=== Template Seed Complete ===');
  console.log(`Families created: ${familiesCreated}`);
  console.log(`Templates created: ${templatesCreated}`);
  console.log(`Activities created: ${activitiesCreated}`);
  console.log(`Logic links created: ${linksCreated}`);
  console.log(`Skipped (already exist): ${skipped}`);

  // Verify
  const totalTemplates = await prisma.workpack_templates.count({
    where: { library_scope: 'PLATFORM' },
  });
  const totalActivities = await prisma.workpack_template_activities.count();
  console.log(`\nVerification — PLATFORM templates: ${totalTemplates}, Total template activities: ${totalActivities}`);
}

export { seedTemplates };

if (require.main === module) {
  seedTemplates()
    .catch((e) => {
      console.error('Seed failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
