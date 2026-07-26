import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export class DisciplineService {
    static async getAll(orgId: string) {
        return prisma.discipline.findMany({
            where: { organization_id: orgId },
            orderBy: { code: 'asc' }
        });
    }

    static async create(orgId: string, data: any, userId: string) {
        const discipline = await prisma.discipline.create({
            data: {
                organization_id: orgId,
                name: data.name,
                code: data.code,
                color: data.color || '#3B82F6',
                is_active: data.is_active ?? true,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'created',
            model_name: 'Discipline',
            model_id: discipline.id,
            new_values: { discipline },
        });

        return discipline;
    }

    static async update(id: string, orgId: string, data: any, userId: string) {
        const old = await prisma.discipline.findFirst({ where: { id, organization_id: orgId } });
        if (!old) throw new Error('Discipline not found');

        const updated = await prisma.discipline.update({
            where: { id },
            data: {
                name: data.name,
                code: data.code,
                color: data.color,
                is_active: data.is_active,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'updated',
            model_name: 'Discipline',
            model_id: id,
            old_values: old,
            new_values: updated,
        });

        return updated;
    }
}
