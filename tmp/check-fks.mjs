import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const rows = await prisma.$queryRawUnsafe(`
  SELECT c.conname, c.conrelid::regclass::text AS tbl, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid::regclass::text IN ('"Area"', '"Unit"', '"Plant"', '"System"', '"Asset"', '"Site"')
  ORDER BY 2, 1
`);
console.log(JSON.stringify(rows, null, 2));
await prisma['$disconnect']();
await pool.end();
