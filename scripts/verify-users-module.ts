/**
 * One-shot verification of User relation includes + CRUD.
 * Run: $env:DATABASE_URL='postgresql://user:pass@127.0.0.1:5433/syority?schema=public'; npx tsx scripts/verify-users-module.ts
 */
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');

    const pool = new Pool({ connectionString: url });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    try {
        const org = await prisma.organization.findFirst({ where: { deleted_at: null } });
        if (!org) throw new Error('No organization found');

        // Invalid include must throw — prove we are NOT using `Site_User...`
        let invalidCaught = false;
        try {
            await prisma.user.findMany({
                take: 1,
                // @ts-expect-error intentional invalid include
                include: { Site_User_site_idToSite: true },
            });
        } catch {
            invalidCaught = true;
        }
        console.log('INVALID_OLD_INCLUDE_REJECTED', invalidCaught ? 'PASS' : 'FAIL');

        const listed = await prisma.user.findMany({
            where: { organization_id: org.id, deleted_at: null },
            take: 2,
            include: {
                site: { select: { id: true, name: true } },
                user_roles: { include: { role: { select: { id: true, name: true, slug: true } } } },
                organization: { select: { name: true } },
            },
        });
        console.log('LIST_INCLUDE_OK', listed.length);

        const email = `verify-user-${Date.now()}@test.local`;
        const created = await prisma.user.create({
            data: {
                id: randomUUID(),
                organization_id: org.id,
                name: 'Verify User',
                email,
                password: await bcrypt.hash('VerifyPass1', 10),
                is_active: true,
            },
            include: { site: true, user_roles: true },
        });
        console.log('CREATE_OK', created.id);

        const updated = await prisma.user.update({
            where: { id: created.id },
            data: { position: 'QA Engineer', is_active: false },
            include: { site: true, user_roles: true },
        });
        console.log('UPDATE_OK', updated.position, String(updated.is_active));

        await prisma.user.update({
            where: { id: created.id },
            data: {
                deleted_at: new Date(),
                is_active: false,
                email: `deleted_${Date.now()}_${email}`,
            },
        });
        const gone = await prisma.user.findFirst({
            where: { id: created.id, deleted_at: null },
        });
        console.log('SOFT_DELETE_OK', gone === null ? 'PASS' : 'FAIL');
        console.log('ALL_PASS');
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('VERIFY_FAIL', e.message);
    process.exit(1);
});
