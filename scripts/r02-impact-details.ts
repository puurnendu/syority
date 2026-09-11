import { prisma, disconnect } from '../prisma/seed-client';

const IDS = [
  '9482d55f-43d9-42d2-903f-04c02c15cb91',
  'a75f827b-3d3d-40a9-a0d3-5c3b954e5168',
  'f2d10377-81f6-47d5-8423-fd86dd8c20fc',
  '34b09267-b87c-4c05-8599-a9c713c582fb',
  '83da5fbe-34cd-457c-b06a-e0fed3151d05',
  '5aaaea5f-3d10-4940-9e94-f5a8af70b4b6',
  'abdc691d-f275-43bf-8600-f006f60b9583',
  'fca0f56b-602b-49c4-a880-bf82211a23ca',
  'd2ea4284-3b7e-42c1-a41b-01327fd0e8c6',
  'feca00c1-1266-4add-9f8e-17a75fb16d96',
  'f10004c0-30d1-4da9-b305-b2a799562a4d',
  '3e9c3eee-7f73-44ba-b992-18b4425aa710',
  'c6180ec4-bf70-4857-bad2-fd2e00e8fce5',
  '8bb860b6-7618-4b58-8023-b0cc8a97764f',
  '0c3c05c6-c477-4031-abff-17edb3f51a16',
  'cf181ee9-3c41-4b51-a3ca-ea9b513f4e92',
];

async function main() {
  const applied = await prisma.$queryRaw`
    SELECT a.id, a.activity_number, a.description, a.event_id, a.workpack_id,
           w.workpack_number, w.asset_id, w.event_id AS wp_event, e.name AS event_name, e.code AS event_code
    FROM "Activity" a
    JOIN "Workpack" w ON w.id = a.workpack_id
    LEFT JOIN events e ON e.id = a.event_id
    WHERE a.id = ANY(${IDS}::uuid[])
    ORDER BY e.name, w.workpack_number, a.activity_number
  `;

  const loose = await prisma.$queryRaw`
    SELECT id, activity_number, event_id, workpack_id, deleted_at
    FROM "Activity"
    WHERE deleted_at IS NULL AND workpack_id IS NULL
  `;

  const unresolvedWp = await prisma.$queryRaw`
    SELECT w.id, w.workpack_number, w.event_id, w.asset_id, w.organization_id, COUNT(a.id)::int AS activities
    FROM "Workpack" w
    JOIN "Activity" a ON a.workpack_id = w.id AND a.deleted_at IS NULL
    WHERE w.id = 'cb290c59-4bdd-45a5-a153-8bc8ecd43fd8'::uuid
    GROUP BY w.id, w.workpack_number, w.event_id, w.asset_id, w.organization_id
  `;

  const org = await prisma.$queryRaw`
    SELECT id, name FROM "Organization" WHERE id = 'bfd38393-e98d-489a-a602-e808be2e0f63'::uuid
  `;

  const wpAssets = await prisma.$queryRaw`
    SELECT COUNT(*) FILTER (WHERE asset_id IS NULL)::int AS no_asset,
           COUNT(*) FILTER (WHERE asset_id IS NOT NULL)::int AS has_asset
    FROM "Workpack"
    WHERE id IN (
      '46e04a98-ce5c-47df-8603-591ae703c4b1',
      'f94832b8-24d9-498e-b384-da30f04d13cc',
      '6a85cc1d-c323-49b5-bfde-ab43d7175d65',
      'f94151f1-57d4-43ab-bd26-74c74ed0c023'
    )
  `;

  const baselineOverlap = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM "BaselineActivity"
    WHERE activity_id = ANY(${IDS}::uuid[])
  `;

  const soft = await prisma.$queryRaw`
    SELECT id, event_id, workpack_id FROM "Activity" WHERE deleted_at IS NOT NULL
  `;

  console.log(JSON.stringify({ org, applied, loose, unresolvedWp, wpAssets, baselineOverlap, soft }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => disconnect());
