import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const email = (process.env.PLATFORM_EMAIL || 'info@syority.com').trim().toLowerCase();
const password = process.env.TEST_PASSWORD || 'Admin@123';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const hash = await bcrypt.hash(password, 12);
const r = await prisma.user.updateMany({
  where: { email },
  data: { password: hash, must_change_password: false },
});
console.log(`password reset count=${r.count}`);
await prisma.$disconnect();
await pool.end();
