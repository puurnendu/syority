import { prisma } from '@/lib/prisma';

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

    static async create(orgId: string, data: any, creatorId: string) {
        return prisma.role.create({
            data: {
                organization_id: orgId,
                name: data.name,
                slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
                permissions: data.permissions || {},
                is_system: data.is_system ?? false,
                created_by: creatorId,
            }
        });
    }

    static async update(id: string, orgId: string, data: any) {
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
