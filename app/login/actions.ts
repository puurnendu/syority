'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

type SetupInput = {
    organizationName: string;
    organizationSlug: string;
    siteName: string;
    siteCode: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
};

export async function createFirstOrganization(formData: SetupInput) {
    const organizationName = formData.organizationName?.trim();
    const adminEmail = formData.adminEmail?.trim();
    const adminPassword = formData.adminPassword;
    if (!organizationName || !adminEmail || !adminPassword) {
        return { error: 'Organization name, admin email, and password are required.' };
    }
    if (adminPassword.length < 8) {
        return { error: 'Password must be at least 8 characters.' };
    }
    const slug = (formData.organizationSlug || organizationName).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'default';
    const code = (formData.siteCode || 'MAIN').trim().toUpperCase().replace(/\s+/g, '-') || 'MAIN';

    try {
        const count = await prisma.organization.count({ where: { deleted_at: null } });
        if (count > 0) {
            return { error: 'Initial setup has already been completed. Please sign in.' };
        }

        const existing = await prisma.organization.findFirst({ where: { slug } });
        if (existing) {
            return { error: 'An organization with this slug already exists. Use a different slug or sign in.' };
        }
        const existingEmail = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingEmail) {
            return { error: 'This email is already registered. Use a different email or sign in.' };
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        const org = await prisma.organization.create({
            data: { name: organizationName, slug, is_active: true },
        });
        const site = await prisma.site.create({
            data: {
                organization_id: org.id,
                name: (formData.siteName || 'Headquarters').trim(),
                code,
                is_active: true,
                created_by: null,
            },
        });
        const user = await prisma.user.create({
            data: {
                organization_id: org.id,
                site_id: site.id,
                name: (formData.adminName || 'Super Admin').trim(),
                email: adminEmail,
                password: hashedPassword,
                position: 'Super Administrator',
                is_active: true,
            },
        });
        await prisma.site.update({
            where: { id: site.id },
            data: { created_by: user.id },
        });
        const role = await prisma.role.create({
            data: {
                organization_id: org.id,
                slug: 'tenant_administrator',
                name: 'Tenant Administrator',
                permissions: ['*'],
                is_system: true,
                created_by: user.id,
            },
        });
        await prisma.userRole.create({
            data: {
                organization_id: org.id,
                user_id: user.id,
                role_id: role.id,
                site_id: site.id,
                assigned_by: user.id,
            },
        });
        revalidatePath('/login');
        return { success: true };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create organization';
        return { error: message };
    }
}
