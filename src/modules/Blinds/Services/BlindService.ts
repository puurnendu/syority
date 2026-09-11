import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { BlindType, BlindTestType } from '@prisma/client';

export class BlindService {
    private static async _verifyExecutionGate(blindId: string, organizationId: string) {
        const blind = await prisma.blind.findFirst({
            where: { id: blindId, organization_id: organizationId },
            include: { workpack: { select: { status: true } } }
        });
        
        if (!blind) throw new Error('Blind not found');
        
        if (blind.workpack.status !== 'issued' && blind.workpack.status !== 'in_execution') {
            throw new Error(`Cannot mutate blind in workpack status: ${blind.workpack.status}`);
        }

        const activityIds = [blind.insert_activity_id, blind.remove_activity_id].filter(Boolean) as string[];
        if (activityIds.length > 0) {
            const activities = await prisma.activity.findMany({
                where: { id: { in: activityIds }, organization_id: organizationId }
            });
            for (const activity of activities) {
                if (activity.workpack_id !== blind.workpack_id) {
                    throw new Error(`Associated activity ${activity.id} does not belong to workpack ${blind.workpack_id}`);
                }
            }
        }
        return blind;
    }

    static async createBlind(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        blind_number: string;
        blind_type: BlindType;
        location?: string;
        line_number?: string;
        service?: string;
        size?: string;
        rating?: string;
        pressure_test_required?: boolean;
        test_type?: BlindTestType;
        test_pressure?: number;
        insert_activity_id?: string;
        remove_activity_id?: string;
        created_by: string;
    }) {
        // Map size to flange_size to match Prisma schema — preserve caller-provided flange_size
        const mappedData: Record<string, unknown> = { ...data };
        if (data.size && !('flange_size' in data)) {
            (mappedData as any).flange_size = data.size;
        }
        delete mappedData.size;

        const created = await prisma.blind.create({ data: { ...mappedData, id: crypto.randomUUID(), status: 'pending', updated_at: new Date() } });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by,
            action: 'created',
            model_name: 'Blind',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });
        return created;
    }

    static async confirmIsolation(id: string, organizationId: string, userId: string) {
        const oldValues = await this._verifyExecutionGate(id, organizationId);
        const updated = await prisma.blind.update({
            where: { id, organization_id: organizationId },
            data: { safe_isolation_confirmed: true, safe_isolation_reference: userId, updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'Blind',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async recordInsert(id: string, organizationId: string, userId: string, insertedAt?: Date) {
        const oldValues = await this._verifyExecutionGate(id, organizationId);
        const updated = await prisma.blind.update({
            where: { id, organization_id: organizationId },
            data: { status: 'inserted', inserted_by: userId, inserted_at: insertedAt ?? new Date(), updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'Blind',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async recordPressureTest(id: string, organizationId: string, userId: string, testPressure: number, testResult: string) {
        const oldValues = await this._verifyExecutionGate(id, organizationId);
        const updated = await prisma.blind.update({
            where: { id, organization_id: organizationId },
            data: { status: 'pressure_tested', test_result: testResult, actual_test_pressure: testPressure, updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'Blind',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async recordRemove(id: string, organizationId: string, userId: string, removedAt?: Date) {
        const oldValues = await this._verifyExecutionGate(id, organizationId);
        const updated = await prisma.blind.update({
            where: { id, organization_id: organizationId },
            data: { status: 'removed', removed_by: userId, removed_at: removedAt ?? new Date(), updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'Blind',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async deleteBlind(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.blind.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Blind not found');
        const updated = await prisma.blind.update({ where: { id, organization_id: organizationId }, data: { deleted_at: new Date() } });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'Blind',
            model_id: id,
            old_values: oldValues as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
            site_id: oldValues.site_id ?? undefined,
        });
        return updated;
    }

    static async getSummary(workpackId: string, organizationId: string) {
        const groups = await prisma.blind.groupBy({
            by: ['status'],
            where: { workpack_id: workpackId, organization_id: organizationId, deleted_at: null },
            _count: { id: true },
        });
        const result: Record<string, number> = { pending: 0, inserted: 0, pressure_tested: 0, removed: 0, cancelled: 0 };
        for (const g of groups) {
            if (g.status) result[g.status] = g._count.id;
        }
        return { ...result, total: Object.values(result).reduce((a, b) => a + b, 0) };
    }

    static async validateAllRemoved(workpackId: string, organizationId: string): Promise<boolean> {
        const notRemoved = await prisma.blind.count({
            where: { workpack_id: workpackId, organization_id: organizationId, status: { in: ['pending', 'inserted', 'pressure_tested'] }, deleted_at: null },
        });
        return notRemoved === 0;
    }
}
