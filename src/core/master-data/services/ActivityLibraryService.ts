import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { generateNextActivityCode } from '@/lib/activityIdGenerator';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';

export class ActivityLibraryService {
    static async getAll(orgId: string) {
        return prisma.activityLibrary.findMany({
            where: {
                organization_id: orgId,
                deleted_at: null
            },
            include: {
                discipline: true,
            },
            orderBy: { name: 'asc' }
        });
    }

    static async create(orgId: string, data: any, userId: string) {
        const activity_code = await generateNextActivityCode(orgId);
        const item = await prisma.activityLibrary.create({
            data: {
                organization_id: orgId,
                name: data.name,
                description: data.description,
                discipline_id: data.discipline_id || null,
                duration_hours: data.duration_hours || 0,
                is_active: data.is_active ?? true,
                activity_code,
                created_by: userId,
                hold_point_type: data.hold_point_type ?? null,
                work_category: data.work_category ?? null,
                phase: data.phase ?? null,
                level_code: data.level_code ?? null,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'CREATE',
            model_name: 'ActivityLibrary',
            model_id: item.id,
            new_values: { ...item },
        });

        enqueueKnowledgeCapture({
            organizationId: orgId,
            category: 'ACTIVITY_CODE',
            assetType: 'ActivityLibrary',
            title: item.name,
            payload: item as unknown as Record<string, unknown>,
        });

        return item;
    }

    static async update(id: string, orgId: string, data: any, userId: string) {
        const old = await prisma.activityLibrary.findFirst({
            where: { id, organization_id: orgId, deleted_at: null }
        });
        if (!old) throw new Error('Library item not found');

        const updated = await prisma.activityLibrary.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.discipline_id !== undefined && { discipline_id: data.discipline_id }),
                ...(data.duration_hours !== undefined && { duration_hours: data.duration_hours }),
                ...(data.is_active !== undefined && { is_active: data.is_active }),
                ...(data.hold_point_type !== undefined && { hold_point_type: data.hold_point_type }),
                ...(data.work_category !== undefined && { work_category: data.work_category }),
                ...(data.phase !== undefined && { phase: data.phase }),
                ...(data.level_code !== undefined && { level_code: data.level_code }),
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'UPDATE',
            model_name: 'ActivityLibrary',
            model_id: id,
            old_values: old,
            new_values: updated,
        });

        enqueueKnowledgeCapture({
            organizationId: orgId,
            category: 'ACTIVITY_CODE',
            assetType: 'ActivityLibrary',
            title: updated.name,
            payload: updated as unknown as Record<string, unknown>,
        });

        return updated;
    }
}
