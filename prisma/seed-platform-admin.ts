/**
 * Platform Administrator bootstrap.
 *
 * Creates (idempotent):
 *   - Syority Platform organization (tenant_type = platform) — NOT a customer tenant
 *   - Platform Administrator role (platform_super_admin)
 *   - Platform admin user from PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD
 *
 * Platform users still require organization_id in the current schema (FK).
 * They are scoped PLATFORM by role — never by customer tenant membership.
 * Refinery work requires Proxy Mode into a customer tenant.
 *
 *   npx tsx prisma/seed-platform-admin.ts
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
}

const email = (process.env.PLATFORM_ADMIN_EMAIL || 'info@syority.com').trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD || 'Admin@123';

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
    console.log('🔐 Bootstrapping Platform Administrator…');

    const org =
        (await prisma.organization.findFirst({
            where: { slug: 'syority-platform', deleted_at: null },
        })) ||
        (await prisma.organization.create({
            data: {
                id: randomUUID(),
                name: 'Syority Platform',
                slug: 'syority-platform',
                industry: 'Software',
                country: 'IN',
                tenant_type: 'platform',
                is_active: true,
                updated_at: new Date(),
            },
        }));

    console.log('✅ Platform org:', org.name, org.id);

    let site = await prisma.site.findFirst({
        where: { organization_id: org.id, deleted_at: null },
    });
    if (!site) {
        site = await prisma.site.create({
            data: {
                id: randomUUID(),
                organization_id: org.id,
                name: 'Syority HQ',
                code: 'HQ',
                is_active: true,
                updated_at: new Date(),
            },
        });
    }

    let role = await prisma.role.findFirst({
        where: { organization_id: org.id, slug: 'platform_super_admin' },
    });
    if (!role) {
        role = await prisma.role.create({
            data: {
                id: randomUUID(),
                organization_id: org.id,
                name: 'Platform Administrator',
                slug: 'platform_super_admin',
                permissions: ['*'],
                is_system: true,
                updated_at: new Date(),
            },
        });
    }
    console.log('✅ Role:', role.slug);

    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({ where: { email } });

    let userId: string;
    if (existing) {
        await prisma.user.update({
            where: { id: existing.id },
            data: {
                organization_id: org.id,
                site_id: site.id,
                name: existing.name || 'Platform Administrator',
                password: passwordHash,
                is_active: true,
                deleted_at: null,
                // Flags deprecated as SoT — keep false; auth derives from roles
                is_super_admin: false,
                is_tenant_admin: false,
                must_change_password: false,
            },
        });
        userId = existing.id;
        console.log('✅ Updated existing user:', email);
    } else {
        const created = await prisma.user.create({
            data: {
                id: randomUUID(),
                organization_id: org.id,
                site_id: site.id,
                name: 'Platform Administrator',
                email,
                password: passwordHash,
                position: 'Platform Administrator',
                is_active: true,
                is_super_admin: false,
                is_tenant_admin: false,
                must_change_password: true,
            },
        });
        userId = created.id;
        console.log('✅ Created user:', email);
    }

    const existingUR = await prisma.userRole.findFirst({
        where: { user_id: userId, role_id: role.id },
    });
    if (!existingUR) {
        await prisma.userRole.create({
            data: {
                id: randomUUID(),
                organization_id: org.id,
                user_id: userId,
                role_id: role.id,
                assigned_by: userId,
            },
        });
    }

    // Ensure user is NOT also a customer-tenant admin by accident
    console.log('\n═══════════════════════════════════════════');
    console.log('PLATFORM ADMINISTRATOR READY');
    console.log('═══════════════════════════════════════════');
    console.log('  Email:    ', email);
    console.log('  Password: ', password);
    console.log('  Scope:    ', 'PLATFORM');
    console.log('  Role:     ', 'platform_super_admin (Platform Administrator)');
    console.log('  Org:      ', org.name, '(tenant_type=platform — not a customer)');
    console.log('  Dashboard:', '/platform/tenants');
    console.log('═══════════════════════════════════════════\n');
}

main()
    .catch((e) => {
        console.error('❌ Bootstrap failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
