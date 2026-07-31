/**
 * Creates or updates only the super admin user (superadmin@aurianoa.com / Admin@123).
 * Run when the full seed is not an option or the account is missing.
 *
 *   npx tsx prisma/seed-superadmin.ts
 */
import { prisma, disconnect } from './seed-client';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('Creating/updating super admin (superadmin@aurianoa.com)...');

    const org = await prisma.organization.findFirst({
        where: { slug: 'auriana-demo', deleted_at: null },
    });
    if (!org) {
        console.error('❌ Organisation "auriana-demo" not found. Run the full seed first: npx prisma db seed');
        process.exit(1);
    }

    const site = await prisma.site.findFirst({
        where: { organization_id: org.id },
    });
    if (!site) {
        console.error('❌ No site found for organisation. Run the full seed first: npx prisma db seed');
        process.exit(1);
    }

    const superAdminRole = await prisma.role.findFirst({
        where: { organization_id: org.id, slug: 'super-admin' },
    });
    if (!superAdminRole) {
        console.error('❌ Role "super-admin" not found. Run the full seed first: npx prisma db seed');
        process.exit(1);
    }

    const adminUser = await prisma.user.findFirst({
        where: { organization_id: org.id, email: 'admin@aurianoa.com', deleted_at: null },
    });

    const passwordHash = await bcrypt.hash('Admin@123', 12);
    const superAdminUser = await prisma.user.upsert({
        where: { email: 'superadmin@aurianoa.com' },
        update: {
            password: passwordHash,
            is_active: true,
            organization_id: org.id,
            site_id: site.id,
        },
        create: {
            organization_id: org.id,
            site_id: site.id,
            name: 'Super Admin',
            email: 'superadmin@aurianoa.com',
            password: passwordHash,
            position: 'Super Administrator',
            is_active: true,
        },
    });

    const existingRole = await prisma.userRole.findFirst({
        where: { user_id: superAdminUser.id, role_id: superAdminRole.id },
    });
    if (!existingRole) {
        await prisma.userRole.create({
            data: {
                organization_id: org.id,
                user_id: superAdminUser.id,
                role_id: superAdminRole.id,
                assigned_by: adminUser?.id ?? superAdminUser.id,
            },
        });
        console.log('✅ Super admin role assigned');
    }

    console.log('✅ Super admin ready: superadmin@aurianoa.com / Admin@123');
    console.log('   Organisation: Auriana Demo Corp (auriana-demo)');
}

main()
    .then(() => disconnect())
    .catch((e) => {
        console.error(e);
        disconnect();
        process.exit(1);
    });
