import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export class SiteService {
    static async getAll(orgId: string) {
        return prisma.site.findMany({
            where: { organization_id: orgId, deleted_at: null },
            include: {
                _count: {
                    select: {
                        Plant: true,
                        Workpack: true,
                        users: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    static async getById(id: string, orgId: string) {
        return prisma.site.findFirst({
            where: { id, organization_id: orgId },
        });
    }

    static async create(orgId: string, data: any, userId: string) {
        const site = await prisma.site.create({
            data: {
                organization_id: orgId,
                name: data.name,
                code: data.code,
                location: data.location,
                timezone: data.timezone || 'UTC',
                is_active: data.is_active ?? true,
                created_by: userId,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'created',
            model_name: 'Site',
            model_id: site.id,
            new_values: { site },
        });

        return site;
    }

    static async update(id: string, orgId: string, data: any, userId: string) {
        const old = await prisma.site.findFirst({ where: { id, organization_id: orgId } });
        if (!old) throw new Error('Site not found');

        const updated = await prisma.site.update({
            where: { id },
            data: {
                name: data.name,
                code: data.code,
                location: data.location,
                timezone: data.timezone,
                is_active: data.is_active,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'updated',
            model_name: 'Site',
            model_id: id,
            old_values: old,
            new_values: updated,
        });

        return updated;
    }

    /** Soft-delete (archive). Prefer HierarchyService for new code. */
    static async delete(id: string, orgId: string, userId: string) {
        const site = await prisma.site.findFirst({
            where: { id, organization_id: orgId, deleted_at: null },
        });
        if (!site) throw new Error('Site not found');

        const deleted = await prisma.site.update({
            where: { id },
            data: { deleted_at: new Date(), is_active: false },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'archived',
            model_name: 'Site',
            model_id: id,
            old_values: site as Record<string, unknown>,
            new_values: deleted as Record<string, unknown>,
        });

        return deleted;
    }
}
