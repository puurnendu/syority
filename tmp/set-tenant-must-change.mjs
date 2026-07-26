import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const email = process.env.TENANT_EMAIL || 'audit-admin@syority.test';
const flag = process.env.FLAG !== 'false';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const r = await prisma.user.updateMany({
  where: { email },
  data: { must_change_password: flag },
});
console.log(`updated=${r.count} must_change_password=${flag}`);
await prisma.$disconnect();
await pool.end();
