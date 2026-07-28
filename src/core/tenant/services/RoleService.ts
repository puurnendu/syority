import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { assertRoleAllowedForOrgScope, isCatalogPlatformRole } from '@/security/roleCatalog';
import { resolveRoleSlug } from '@/lib/permissions';

export class RoleService {
    static async getAll(orgId: string) {
        return prisma.role.findMany({
            where: { organization_id: orgId },
            include: {
                _count: {
                    select: { user_roles: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    static async getById(id: string, orgId: string) {
        return prisma.role.findFirst({
            where: { id, organization_id: orgId }
        });
    }

    private static async orgTenantType(orgId: string): Promise<string | null> {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { tenant_type: true },
        });
        return org?.tenant_type ?? null;
    }

    static async create(orgId: string, data: any, creatorId: string) {
        const slug = resolveRoleSlug(
            data.slug || String(data.name || '').toLowerCase().replace(/\s+/g, '_')
        );
        const tenantType = await this.orgTenantType(orgId);
        assertRoleAllowedForOrgScope(slug, tenantType);

        // Tenants cannot invent platform-scoped custom roles
        if (isCatalogPlatformRole(slug) && (tenantType || '').toLowerCase() !== 'platform') {
            throw new Error('Platform roles cannot exist inside a tenant');
        }

        return prisma.role.create({
            data: {
                id: randomUUID(),
                organization_id: orgId,
                name: data.name,
                slug,
                permissions: data.permissions || {},
                is_system: data.is_system ?? false,
                created_by: creatorId,
                updated_at: new Date(),
            }
        });
    }

    static async update(id: string, orgId: string, data: any) {
        const existing = await prisma.role.findFirst({ where: { id, organization_id: orgId } });
        if (!existing) throw new Error('Role not found');
        if (existing.is_system && data.slug && resolveRoleSlug(data.slug) !== existing.slug) {
            throw new Error('Cannot rename system role slugs');
        }

        return prisma.role.update({
            where: { id },
            data: {
                name: data.name,
                permissions: data.permissions,
                is_system: data.is_system,
            }
        });
    }

    static async delete(id: string, orgId: string) {
        const role = await prisma.role.findFirst({ where: { id, organization_id: orgId } });
        if (!role) throw new Error('Role not found');
        if (role.is_system) throw new Error('Cannot delete system roles');

        return prisma.role.delete({ where: { id } });
    }
}
