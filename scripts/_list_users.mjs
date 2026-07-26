import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://user:pass@127.0.0.1:5433/syority?schema=public',
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const users = await prisma.user.findMany({
  where: { deleted_at: null },
  orderBy: [{ organization: { name: 'asc' } }, { email: 'asc' }],
  select: {
    id: true,
    email: true,
    name: true,
    is_active: true,
    is_super_admin: true,
    is_tenant_admin: true,
    organization: { select: { id: true, name: true, slug: true } },
    user_roles: { select: { role: { select: { slug: true, name: true } } } },
  },
});

for (const u of users) {
  const roles =
    u.user_roles.map((ur) => ur.role.slug).join(', ') || '(none)';
  console.log(
    [
      u.id,
      u.email,
      u.name,
      u.organization?.name ?? '(no org)',
      u.organization?.id ?? '',
      roles,
      `active=${u.is_active}`,
      `is_super_admin=${u.is_super_admin}`,
      `is_tenant_admin=${u.is_tenant_admin}`,
    ].join(' | ')
  );
}

console.log(`\nTotal: ${users.length}`);
await prisma.$disconnect();
await pool.end();
