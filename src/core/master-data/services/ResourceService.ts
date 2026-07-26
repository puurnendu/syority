import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export class ResourceService {
    static async getAll(orgId: string) {
        return prisma.resource.findMany({
            where: {
                organization_id: orgId,
                deleted_at: null
            },
            include: {
                resource_type: true,
                contractor: true,
            },
            orderBy: { name: 'asc' }
        });
    }

    static async create(orgId: string, data: any, userId: string) {
        const resource = await prisma.resource.create({
            data: {
                organization_id: orgId,
                site_id: data.site_id || null,
                resource_type_id: data.resource_type_id,
                contractor_id: data.contractor_id || null,
                name: data.name,
                employee_id: data.employee_id,
                craft_code: data.craft_code,
                is_active: data.is_active ?? true,
                created_by: userId,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'created',
            model_name: 'Resource',
            model_id: resource.id,
            new_values: { resource },
        });

        return resource;
    }

    static async update(id: string, orgId: string, data: any, userId: string) {
        const old = await prisma.resource.findFirst({
            where: { id, organization_id: orgId, deleted_at: null }
        });
        if (!old) throw new Error('Resource not found');

        const updated = await prisma.resource.update({
            where: { id },
            data: {
                site_id: data.site_id,
                resource_type_id: data.resource_type_id,
                contractor_id: data.contractor_id,
                name: data.name,
                employee_id: data.employee_id,
                craft_code: data.craft_code,
                is_active: data.is_active,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'updated',
            model_name: 'Resource',
            model_id: id,
            old_values: old,
            new_values: updated,
        });

        return updated;
    }
}
