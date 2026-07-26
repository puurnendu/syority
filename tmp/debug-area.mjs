import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] });

try {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Area' ORDER BY ordinal_position
  `);
  console.log('Area columns', cols);

  const rows = await prisma.area.findMany({
    take: 2,
    where: { deleted_at: null },
    include: {
      plant: { select: { id: true, name: true, code: true } },
      site: { select: { id: true, name: true, code: true } },
      _count: { select: { units: true } },
    },
  });
  console.log('findMany OK', rows.length, rows[0]?.code);

  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  console.log('org OK', org?.name);

  const flags = await prisma.featureFlag.findMany({ take: 3 });
  console.log('flags OK', flags.length);
} catch (e) {
  console.error('ERR code=', e.code);
  console.error('ERR msg=', e.message);
  console.error('ERR meta=', JSON.stringify(e.meta || {}, null, 2));
  process.exitCode = 1;
} finally {
  await prisma['$disconnect']();
  await pool.end();
}
