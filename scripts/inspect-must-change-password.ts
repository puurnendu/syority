import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'audit', mode: 'insensitive' } },
        { email: { contains: 'syority', mode: 'insensitive' } },
        { is_super_admin: true },
      ],
      deleted_at: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      must_change_password: true,
      is_super_admin: true,
      is_tenant_admin: true,
      updated_at: true,
      last_login_at: true,
      created_at: true,
    },
    orderBy: { email: 'asc' },
  });
  console.log(JSON.stringify(users, null, 2));

  // Also dump who seed.ts would hit: first is_super_admin
  const firstSuper = await prisma.user.findFirst({
    where: { is_super_admin: true },
    select: { id: true, email: true, must_change_password: true },
    orderBy: { created_at: 'asc' },
  });
  console.log('SEED_TARGET_first_is_super_admin=', JSON.stringify(firstSuper));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
