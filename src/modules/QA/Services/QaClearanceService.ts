import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';

export class QaClearanceService {
    static async createClearance(data: {
        organization_id: string;
        workpack_id: string;
        activity_id: string;
        cleared_by: string;
        cleared_at: Date;
        certificate_number?: string;
        witness_name?: string;
        notes?: string;
    }) {
        // 1. Create the clearance record
        const created = await prisma.qaClearanceRecord.create({
            data: {
                ...data,
            }
        });

        // 2. Log audit
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.cleared_by,
            action: 'created',
            model_name: 'QaClearanceRecord',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
        });

        // 3. Emit event
        (eventBus as { emit: (e: string, d: unknown) => boolean }).emit('qa.clearance_created', {
            clearanceId: created.id,
            activityId: data.activity_id,
            workpackId: data.workpack_id
        });

        return created;
    }

    static async getClearancesByActivity(activityId: string, organizationId: string) {
        return prisma.qaClearanceRecord.findMany({
            where: {
                activity_id: activityId,
                organization_id: organizationId
            },
            orderBy: { cleared_at: 'desc' }
        });
    }

    static async getClearancesByWorkpack(workpackId: string, organizationId: string) {
        return prisma.qaClearanceRecord.findMany({
            where: {
                workpack_id: workpackId,
                organization_id: organizationId
            },
            include: {
                activity: {
                    select: {
                        description: true,
                        sequence_number: true
                    }
                }
            },
            orderBy: { cleared_at: 'desc' }
        });
    }

    static async deleteClearance(id: string, organizationId: string, deletedBy: string) {
        const deleted = await prisma.qaClearanceRecord.delete({
            where: { id, organization_id: organizationId }
        });

        await AuditService.log({
            organization_id: organizationId,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'QaClearanceRecord',
            model_id: id,
            old_values: deleted as Record<string, unknown>,
        });

        (eventBus as { emit: (e: string, d: unknown) => boolean }).emit('qa.clearance_deleted', {
            clearanceId: id,
            activityId: deleted.activity_id,
            workpackId: deleted.workpack_id
        });

        return deleted;
    }
}
