import { prisma, disconnect } from '../prisma/seed-client';

async function main() {
  const org = '2a8506b1-2b39-4c79-982f-fae17333567d';
  const libs = await prisma.$queryRaw`
    SELECT activity_code, name, discipline_id
    FROM "ActivityLibrary"
    WHERE organization_id = ${org}::uuid
      AND deleted_at IS NULL
      AND (
        activity_code ILIKE 'ACT-001'
        OR activity_code ILIKE 'ACT-002'
        OR activity_code ILIKE 'ACT-003'
        OR activity_code ILIKE 'ACT-%001%'
        OR activity_code ILIKE 'EVM-%'
      )
    ORDER BY activity_code
    LIMIT 40
  `;
  const prefixes = await prisma.$queryRaw`
    SELECT left(activity_code, 8) AS prefix, COUNT(*)::int AS n
    FROM "ActivityLibrary"
    WHERE organization_id = ${org}::uuid AND deleted_at IS NULL AND activity_code IS NOT NULL
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 20
  `;
  const satEq = await prisma.$queryRaw`
    SELECT s.code, s.name, s.equipment_type_id, e.code AS eq_code, e.name AS eq_name
    FROM standard_activity_types s
    LEFT JOIN "EquipmentType" e ON e.id = s.equipment_type_id
    WHERE s.code = 'TUBE_REPL' OR s.name ILIKE 'Inspection' OR s.name ILIKE 'Leak Test' OR s.name ILIKE 'Cleaning'
    ORDER BY s.name, e.code
  `;
  const hxAssets = await prisma.$queryRaw`
    SELECT organization_id, tag_number, equipment_type_id
    FROM "Asset"
    WHERE tag_number ILIKE 'HX-101%' OR tag_number ILIKE 'V-201%' OR tag_number ILIKE 'E-301%'
  `;
  console.log(JSON.stringify({ libs, prefixes, satEq, hxAssets }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => disconnect());
