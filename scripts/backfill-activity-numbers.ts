import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Set it in .env or the environment.');
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting activity_number backfill...\n');

  const workpacks = await prisma.workpack.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      title: true,
      unit_code: true,
      activities: {
        where: { deleted_at: null },
        orderBy: { sequence_number: 'asc' },
        select: { id: true, description: true, activity_number: true },
      },
    },
  });

  let totalUpdated = 0;

  for (const wp of workpacks) {
    const toUpdate = wp.activities.filter((a) => !a.activity_number);
    if (toUpdate.length === 0) {
      console.log(`✓ ${wp.title} — all activities already have codes`);
      continue;
    }

    const rawTag = (wp.unit_code ?? wp.title ?? 'WP')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 6) || 'WP';

    const existing = wp.activities
      .filter((a) => a.activity_number)
      .map((a) => {
        const parts = a.activity_number!.split('_');
        return parseInt(parts[parts.length - 1], 10) || 0;
      });
    let seq = existing.length > 0 ? Math.max(...existing) : 0;

    console.log(`Processing: ${wp.title} (tag: ${rawTag}, ${toUpdate.length} to update)`);

    for (const act of toUpdate) {
      seq++;
      const activityNumber = `${rawTag}_${String(seq).padStart(3, '0')}`;

      await prisma.activity.update({
        where: { id: act.id },
        data: { activity_number: activityNumber },
      });

      console.log(`  ${act.description?.slice(0, 40)} → ${activityNumber}`);
      totalUpdated++;
    }
  }

  console.log(`\n✅ Done. Updated ${totalUpdated} activities.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
