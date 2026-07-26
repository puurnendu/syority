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
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Setting up SYORITY Corporation...');

    // ── 1. Create / update SYORITY Corporation org ─────
    const syorityOrg = await prisma.organization.upsert({
        where: { slug: 'syority' },
        update: {
            name: 'SYORITY Corporation',
            is_active: true,
            deployment_model: 'platform',
            plan_tier: 'platform',
            status: 'active',
            notes: 'Platform owner organisation. Super admins only.',
        },
        create: {
            name: 'SYORITY Corporation',
            slug: 'syority',
            industry: 'Software / Platform',
            country: 'India',
            timezone: 'Asia/Kolkata',
            is_active: true,
            deployment_model: 'platform',
            plan_tier: 'platform',
            status: 'active',
            notes: 'Platform owner organisation. Super admins only.',
        },
    });
    console.log(`✅ Organisation: SYORITY Corporation (${syorityOrg.id})`);

    // ── 2. Create / update SYORITY HQ site ────────────
    const syoritySite = await prisma.site.upsert({
        where: {
            organization_id_code: {
                organization_id: syorityOrg.id,
                code: 'HQ',
            },
        },
        update: {},
        create: {
            organization_id: syorityOrg.id,
            name: 'SYORITY HQ',
            code: 'HQ',
            location: 'India',
            timezone: 'Asia/Kolkata',
            is_active: true,
        },
    });
    console.log('✅ Site: SYORITY HQ');

    // ── 3. Create Platform Super Admin role in SYORITY org ──
    const superAdminRole = await prisma.role.upsert({
        where: {
            organization_id_slug: {
                organization_id: syorityOrg.id,
                slug: 'platform-super-admin',
            },
        },
        update: { permissions: ['*'] },
        create: {
            organization_id: syorityOrg.id,
            name: 'Platform Super Admin',
            slug: 'platform-super-admin',
            permissions: ['*'],
            is_system: true,
        },
    });
    console.log('✅ Role: Platform Super Admin');

    // ── 4. Create info@syority.com super admin ─────────
    const passwordHash = await bcrypt.hash('Admin@123', 12);

    const existingUser = await prisma.user.findUnique({
        where: { email: 'info@syority.com' },
        include: { user_roles: { include: { role: true } } },
    });

    let superAdminUser: { id: string; email: string; name: string };
    if (existingUser) {
        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                organization_id: syorityOrg.id,
                site_id: syoritySite.id,
                name: 'Syority Super Admin',
                password: passwordHash,
                is_active: true,
                deleted_at: null,
            },
        });
        superAdminUser = { id: existingUser.id, email: existingUser.email, name: 'Syority Super Admin' };
        // Remove old UserRoles for this user (they may be in other orgs)
        await prisma.userRole.deleteMany({ where: { user_id: existingUser.id } });
    } else {
        const created = await prisma.user.create({
            data: {
                organization_id: syorityOrg.id,
                site_id: syoritySite.id,
                name: 'Syority Super Admin',
                email: 'info@syority.com',
                password: passwordHash,
                is_active: true,
            },
        });
        superAdminUser = { id: created.id, email: created.email, name: created.name };
    }

    await prisma.userRole.create({
        data: {
            organization_id: syorityOrg.id,
            user_id: superAdminUser.id,
            role_id: superAdminRole.id,
            assigned_by: superAdminUser.id,
        },
    });
    console.log(`✅ Super Admin: info@syority.com`);

    // ── 5. Downgrade super_admins outside SYORITY ─────
    const superAdminRoleIds = await prisma.role.findMany({
        where: { slug: 'super-admin', organization_id: { not: syorityOrg.id } },
        select: { id: true, organization_id: true },
    });

    for (const role of superAdminRoleIds) {
        const wrongUserRoles = await prisma.userRole.findMany({
            where: { role_id: role.id },
            include: { user: { select: { id: true, email: true, organization_id: true } } },
        });
        for (const ur of wrongUserRoles) {
            if (ur.user.organization_id === syorityOrg.id) continue;
            console.log(`⚠ Downgrading super_admin: ${ur.user.email} (org ${ur.user.organization_id}) → org_admin`);
            await prisma.userRole.delete({ where: { id: ur.id } });
            const orgAdminRole = await prisma.role.findFirst({
                where: { organization_id: ur.user.organization_id, slug: 'org-admin' },
            });
            if (orgAdminRole) {
                await prisma.userRole.create({
                    data: {
                        organization_id: ur.user.organization_id,
                        user_id: ur.user.id,
                        role_id: orgAdminRole.id,
                        assigned_by: superAdminUser.id,
                    },
                });
            }
        }
    }
    console.log('✅ Super admins outside SYORITY downgraded to org_admin where applicable');

    // ── 6. Print summary ───────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('SYORITY SETUP COMPLETE');
    console.log('═══════════════════════════════════════════');
    console.log('\n🔑 PLATFORM SUPER ADMIN:');
    console.log('   Org:      SYORITY Corporation');
    console.log('   Email:    info@syority.com');
    console.log('   Password: Admin@123');
    console.log('   Role:     Platform Super Admin');
    console.log('   Access:   Full platform access');
    console.log('\n📋 LOGIN INSTRUCTIONS:');
    console.log('   1. Select "SYORITY Corporation" from org dropdown');
    console.log('   2. Email: info@syority.com');
    console.log('   3. Password: Admin@123');
    console.log('═══════════════════════════════════════════\n');

    const allSuperAdmins = await prisma.user.findMany({
        where: {
            deleted_at: null,
            user_roles: {
                some: { role: { slug: 'super-admin' } },
            },
        },
        include: { organization: { select: { name: true } } },
    });
    console.log('Current super_admin users:');
    allSuperAdmins.forEach((u) => console.log(`  ${u.email} → ${u.organization.name}`));
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
