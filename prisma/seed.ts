import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString || typeof connectionString !== 'string') {
    console.error('❌ DATABASE_URL is not set or invalid.');
    process.exit(1);
}

const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL;
const PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD;

if (!PLATFORM_ADMIN_EMAIL) {
    throw new Error('PLATFORM_ADMIN_EMAIL environment variable is required');
}
if (!PLATFORM_ADMIN_PASSWORD) {
    throw new Error('PLATFORM_ADMIN_PASSWORD environment variable is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding Syority Platform...');

    // --- Guard: skip if platform admin already exists ---
    const existingAdmin = await prisma.user.findFirst({
        where: { is_super_admin: true },
    });
    if (existingAdmin) {
        console.log('✅ Platform admin already exists — forcing password change flag update.');
        await prisma.$executeRaw`UPDATE "User" SET "must_change_password" = TRUE WHERE id = ${existingAdmin.id}::uuid`;
        return;
    }

    // 1. Upsert platform organization
    const org = await prisma.organization.upsert({
        where: { slug: 'syority-platform' },
        update: {},
        create: {
            name: 'Syority Technologies',
            slug: 'syority-platform',
            is_active: true,
        },
    });
    console.log('✅ Organization:', org.name);

    // 2. Upsert a default site for the platform org
    const site = await prisma.site.upsert({
        where: { organization_id_code: { organization_id: org.id, code: 'HQ' } },
        update: {},
        create: {
            organization_id: org.id,
            name: 'Syority HQ',
            code: 'HQ',
            is_active: true,
            created_by: null as any,
        },
    });
    console.log('✅ Site:', site.name);

    // 3. Create platform super admin role
    const platformRole = await prisma.role.upsert({
        where: { organization_id_slug: { organization_id: org.id, slug: 'platform_super_admin' } },
        update: { permissions: ['*'] },
        create: {
            organization_id: org.id,
            name: 'Platform Super Admin',
            slug: 'platform_super_admin',
            permissions: ['*'],
            is_system: true,
            created_by: null as any,
        },
    });
    console.log('✅ Role:', platformRole.name);

    // 4. Upsert platform admin user (env-driven, must change password on first login)
    const hashedPassword = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD!, 12);
    const adminUser = await prisma.user.upsert({
        where: { email: PLATFORM_ADMIN_EMAIL! },
        update: {},
        create: {
            organization_id: org.id,
            site_id: site.id,
            name: 'Platform Admin',
            email: PLATFORM_ADMIN_EMAIL!,
            password: hashedPassword,
            position: 'Platform Administrator',
            is_active: true,
            is_super_admin: true,
            // must_change_password: true, // Prisma Client doesn't know about this yet
        },
    });

    // --- Hard-bypass for must_change_password ---
    await prisma.$executeRaw`UPDATE "User" SET "must_change_password" = TRUE WHERE id = ${adminUser.id}::uuid`;
    console.log('✅ Platform Admin created and forced to change password:', adminUser.email);

    // Update site created_by
    await prisma.site.update({
        where: { id: site.id },
        data: { created_by: adminUser.id },
    });

    // 5. Assign platform_super_admin role
    const existingUR = await prisma.userRole.findFirst({
        where: { user_id: adminUser.id, role_id: platformRole.id },
    });
    if (!existingUR) {
        await prisma.userRole.create({
            data: {
                organization_id: org.id,
                user_id: adminUser.id,
                role_id: platformRole.id,
                assigned_by: adminUser.id,
            },
        });
    }
    console.log('✅ Role assigned: platform_super_admin');

    console.log('\n🎉 Platform seed complete!');
    console.log(`   Login: ${PLATFORM_ADMIN_EMAIL} / ${PLATFORM_ADMIN_PASSWORD}`);
    console.log('   ⚠️  Password change required on first login.');
}

import { seedNotificationPlatform } from './seeds/notification-seed';
import { seedReportBuilder } from './seeds/report-builder-seed';

main()
    .then(async () => {
        // M7.6: Always seed notification templates & rules (idempotent)
        await seedNotificationPlatform();
        // M7.6A: Always seed report builder definitions (idempotent)
        await seedReportBuilder();
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
