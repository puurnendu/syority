import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export class OrgService {
    static async getById(id: string) {
        return prisma.organization.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        User: true,
                        Site: true,
                    }
                }
            }
        });
    }

    static async update(id: string, data: any, userId: string) {
        const old = await prisma.organization.findUnique({ where: { id } });

        const updated = await prisma.organization.update({
            where: { id },
            data: {
                name: data.name,
                industry: data.industry,
                country: data.country,
                timezone: data.timezone,
                logo_url: data.logoUrl || data.logo_url || undefined,
                settings: data.settings || undefined,
                ...(data.activity_id_increment !== undefined && { activity_id_increment: Number(data.activity_id_increment) }),
            },
        });

        await AuditService.log({
            organization_id: id,
            user_id: userId,
            action: 'updated',
            model_name: 'Organization',
            model_id: id,
            old_values: old as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
        });

        return updated;
    }

    static async getStats(id: string) {
        const [users, sites, workpacks] = await Promise.all([
            prisma.user.count({ where: { organization_id: id } }),
            prisma.site.count({ where: { organization_id: id } }),
            prisma.workpack.count({ where: { organization_id: id } }),
        ]);

        return { users, sites, workpacks };
    }
}
