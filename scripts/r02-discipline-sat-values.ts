/**
 * Read-only dump of the actual identity tokens on live Activities
 * and the master-data catalogs they could match.
 */
import { prisma, disconnect } from '../prisma/seed-client';

async function main() {
  const activities = await prisma.$queryRaw<Array<{
    id: string;
    organization_id: string;
    workpack_id: string | null;
    event_id: string | null;
    activity_number: string | null;
    description: string;
    work_category: string | null;
    sequence_number: number | null;
    wp_number: string | null;
    wp_title: string | null;
    wp_eq: string | null;
    wp_job: string | null;
    wp_asset: string | null;
    ev_code: string | null;
    ev_disc: string | null;
  }>>`
    SELECT
      a.id, a.organization_id, a.workpack_id, a.event_id,
      a.activity_number, a.description, a.work_category, a.sequence_number,
      w.workpack_number AS wp_number, w.title AS wp_title,
      w.equipment_type AS wp_eq, w.job_type AS wp_job, w.asset_id AS wp_asset,
      e.code AS ev_code, e.discipline_id AS ev_disc
    FROM "Activity" a
    LEFT JOIN "Workpack" w ON w.id = a.workpack_id
    LEFT JOIN events e ON e.id = a.event_id
    WHERE a.deleted_at IS NULL
    ORDER BY a.organization_id, w.workpack_number, a.sequence_number, a.description
  `;

  const numbers = [...new Set(activities.map((a) => a.activity_number).filter(Boolean))];
  const cats = [...new Set(activities.map((a) => a.work_category).filter(Boolean))];
  const descs = [...new Set(activities.map((a) => a.description))];

  const libs = await prisma.$queryRaw<Array<{
    organization_id: string;
    activity_code: string | null;
    name: string;
    discipline_id: string | null;
    n: number;
  }>>`
    SELECT organization_id, activity_code, name, discipline_id, 1::int AS n
    FROM "ActivityLibrary"
    WHERE deleted_at IS NULL AND COALESCE(is_active, true) = true
    ORDER BY activity_code
  `;

  const sats = await prisma.$queryRaw<Array<{
    id: string;
    organization_id: string | null;
    equipment_type_id: string;
    code: string;
    name: string;
  }>>`
    SELECT id, organization_id, equipment_type_id, code, name
    FROM standard_activity_types
    WHERE is_active = true
    ORDER BY code, equipment_type_id
  `;

  const discs = await prisma.$queryRaw<Array<{
    id: string;
    organization_id: string;
    code: string;
    name: string;
  }>>`
    SELECT id, organization_id, code, name FROM "Discipline" WHERE COALESCE(is_active, true) = true
  `;

  const eq = await prisma.$queryRaw<Array<{ id: string; org_id: string; code: string | null; name: string }>>`
    SELECT id, org_id, code, name FROM "EquipmentType" WHERE is_active = true
  `;

  const assets = await prisma.$queryRaw<Array<{
    id: string;
    organization_id: string;
    tag_number: string | null;
    equipment_type_id: string | null;
    name: string | null;
  }>>`
    SELECT id, organization_id, tag_number, equipment_type_id, name FROM "Asset"
    WHERE id IN (
      SELECT asset_id FROM "Workpack" WHERE asset_id IS NOT NULL
    )
  `;

  console.log(JSON.stringify({
    n: activities.length,
    unique_activity_numbers: numbers,
    unique_work_categories: cats,
    unique_descriptions: descs,
    activities,
    library_codes: [...new Set(libs.map((l) => l.activity_code))].slice(0, 80),
    library_code_prefixes: prefixCount(libs.map((l) => l.activity_code)),
    sat_codes: [...new Map(sats.map((s) => [s.code, { code: s.code, name: s.name, n: sats.filter((x) => x.code === s.code).length }])).values()],
    sat_names: [...new Map(sats.map((s) => [s.name, { name: s.name, n: sats.filter((x) => x.name === s.name).length }])).values()],
    disciplines: discs,
    equipment_type_sample: eq.slice(0, 30),
    assets_on_workpacks: assets,
    org_activity_counts: countBy(activities, (a) => a.organization_id),
  }, null, 2));
}

function prefixCount(codes: Array<string | null>) {
  const m = new Map<string, number>();
  for (const c of codes) {
    if (!c) continue;
    const p = c.split(/[-_]/)[0];
    m.set(p, (m.get(p) ?? 0) + 1);
  }
  return Object.fromEntries(m);
}

function countBy<T>(rows: T[], fn: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(fn(r), (m.get(fn(r)) ?? 0) + 1);
  return Object.fromEntries(m);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => disconnect());
