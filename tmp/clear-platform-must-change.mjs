import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const email = process.env.PLATFORM_EMAIL || 'info@syority.com';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const r = await prisma.user.updateMany({
  where: { email },
  data: { must_change_password: false },
});
console.log(`cleared must_change for ${email}: ${r.count}`);
await prisma.$disconnect();
await pool.end();
