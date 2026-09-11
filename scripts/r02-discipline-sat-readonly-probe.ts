/**
 * Read-only probe of live Activity identity sources.
 * Does not UPDATE any row.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { prisma, disconnect } from '../prisma/seed-client';

async function tableExists(name: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `;
  return rows[0]?.exists === true;
}

async function columns(table: string) {
  return prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;
}

async function main() {
  const wpCols = (await columns('Workpack')).map((c) => c.column_name);
  const actCols = (await columns('Activity')).map((c) => c.column_name);

  const activities = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      a.id, a.organization_id, a.workpack_id, a.event_id,
      a.activity_library_id, a.activity_number, a.activity_id,
      a.description, a.work_category, a.responsible,
      a.discipline_id, a.standard_activity_type_id,
      a.sequence_number, a.hold_point_type, a.notes
    FROM "Activity" a
    WHERE a.deleted_at IS NULL
    ORDER BY a.organization_id, a.workpack_id, a.sequence_number, a.id
  `;

  const workpacks = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      id, organization_id, workpack_number, title, template_id,
      discipline_id, equipment_type, job_type, work_type, work_type_id,
      asset_id, event_id, unit_id, plant_id, system_id
    FROM "Workpack"
  `;

  const orgs = [...new Set(activities.map((a) => String(a.organization_id)))];

  const disciplines = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, organization_id, code, name, is_active FROM "Discipline" ORDER BY organization_id, code
  `;

  const equipmentTypes = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, org_id, code, name, is_active FROM "EquipmentType" ORDER BY org_id, code
  `;

  const sats = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, organization_id, equipment_type_id, code, name, is_active
    FROM standard_activity_types
    ORDER BY equipment_type_id, code
  `;

  const libraries = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, organization_id, activity_code, name, discipline_id, work_category, phase, is_active, deleted_at
    FROM "ActivityLibrary"
    ORDER BY organization_id, activity_code
  `;

  let templates: Array<Record<string, unknown>> = [];
  let templateActivities: Array<Record<string, unknown>> = [];
  if (await tableExists('workpack_templates')) {
    templates = await prisma.$queryRaw`
      SELECT id, organization_id, name, equipment_type, job_type, discipline_id,
             lifecycle_status, is_active, deleted_at
      FROM workpack_templates
    `;
  }
  if (await tableExists('workpack_template_activities')) {
    templateActivities = await prisma.$queryRaw`
      SELECT id, organization_id, template_id, sequence_number, activity_code,
             activity_library_id, description
      FROM workpack_template_activities
      ORDER BY template_id, sequence_number
    `;
  }

  const assets = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, organization_id, tag_number, equipment_type_id, name
    FROM "Asset"
  `;

  const events = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, organization_id, code, name, discipline_id FROM events
  `;

  const libByOrg = orgs.map((org) => ({
    org,
    n: libraries.filter((l) => String(l.organization_id) === org).length,
    codes: libraries
      .filter((l) => String(l.organization_id) === org)
      .map((l) => ({ code: l.activity_code, name: l.name, discipline_id: l.discipline_id })),
  }));

  const satByEq = new Map<string, number>();
  for (const s of sats) {
    const k = String(s.equipment_type_id);
    satByEq.set(k, (satByEq.get(k) ?? 0) + 1);
  }

  const descCounts = new Map<string, number>();
  for (const a of activities) {
    const d = String(a.description ?? '').trim().toLowerCase();
    descCounts.set(d, (descCounts.get(d) ?? 0) + 1);
  }

  const out = {
    read_only: true,
    live_activities: activities.length,
    activity_columns: actCols,
    workpack_columns: wpCols,
    workpack_count: workpacks.length,
    discipline_count: disciplines.length,
    disciplines,
    equipment_type_count: equipmentTypes.length,
    equipment_types: equipmentTypes,
    sat_count: sats.length,
    sats,
    sat_by_equipment_type: Object.fromEntries(satByEq),
    library_count: libraries.length,
    libraries_by_org: libByOrg,
    template_count: templates.length,
    templates: templates.map((t) => ({
      id: t.id,
      org: t.organization_id,
      name: t.name,
      equipment_type: t.equipment_type,
      job_type: t.job_type,
      discipline_id: t.discipline_id,
      status: t.lifecycle_status,
    })),
    template_activity_count: templateActivities.length,
    template_activities_sample: templateActivities.slice(0, 40),
    activity_library_id_set: activities.filter((a) => a.activity_library_id).length,
    activity_number_set: activities.filter((a) => a.activity_number).length,
    activity_id_set: activities.filter((a) => a.activity_id).length,
    work_category_set: activities.filter((a) => a.work_category).length,
    discipline_set: activities.filter((a) => a.discipline_id).length,
    sat_set: activities.filter((a) => a.standard_activity_type_id).length,
    unique_descriptions: [...descCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40),
    workpacks: workpacks.map((w) => ({
      id: w.id,
      org: w.organization_id,
      number: w.workpack_number,
      title: w.title,
      template_id: w.template_id,
      discipline_id: w.discipline_id,
      equipment_type: w.equipment_type,
      job_type: w.job_type,
      work_type: w.work_type,
      work_type_id: w.work_type_id,
      asset_id: w.asset_id,
      event_id: w.event_id,
    })),
    events,
    assets: assets.map((a) => ({
      id: a.id,
      org: a.organization_id,
      tag: a.tag_number,
      eq: a.equipment_type_id,
    })),
    activities: activities.map((a) => ({
      id: a.id,
      org: a.organization_id,
      wp: a.workpack_id,
      event: a.event_id,
      lib: a.activity_library_id,
      activity_number: a.activity_number,
      activity_id: a.activity_id,
      description: a.description,
      work_category: a.work_category,
      seq: a.sequence_number,
      disc: a.discipline_id,
      sat: a.standard_activity_type_id,
    })),
  };

  const dir = join(process.cwd(), 'var', 'r02-identity-backfill');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'discipline-sat-probe.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    live: activities.length,
    lib_linked: out.activity_library_id_set,
    activity_number: out.activity_number_set,
    activity_id: out.activity_id_set,
    work_category: out.work_category_set,
    disc_set: out.discipline_set,
    sat_set: out.sat_set,
    disciplines: disciplines.length,
    sats: sats.length,
    equipment_types: equipmentTypes.length,
    libraries: libraries.length,
    templates: templates.length,
    template_activities: templateActivities.length,
    workpacks: workpacks.length,
    unique_descriptions_top: out.unique_descriptions.slice(0, 15),
    wp_with_template: workpacks.filter((w) => w.template_id).length,
    wp_with_eq: workpacks.filter((w) => w.equipment_type).length,
    wp_with_disc: workpacks.filter((w) => w.discipline_id).length,
    wp_with_asset: workpacks.filter((w) => w.asset_id).length,
    persisted: join(dir, 'discipline-sat-probe.json'),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
