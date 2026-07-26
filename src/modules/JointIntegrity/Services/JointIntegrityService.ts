import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { TighteningMethod } from '@prisma/client';

export class JointIntegrityService {
    static async createJoint(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        joint_number: string;
        joint_type?: string;
        nominal_bore?: string;
        pipe_spec?: string;
        location?: string;
        line_number?: string;
        tightening_method?: string;
        torque_value?: number;
        bolt_count?: number;
        created_by: string;
    }) {
        const created = await prisma.jointIntegrityItem.create({
            data: {
                ...data,
                status: 'pending',
                tightening_method: data.tightening_method ? (data.tightening_method as TighteningMethod) : undefined,
            },
        });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by ?? '',
            action: 'created',
            model_name: 'JointIntegrityItem',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });
        return created;
    }

    static async markAssembled(id: string, organizationId: string, userId: string, assembledAt?: Date) {
        const oldValues = await prisma.jointIntegrityItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Joint not found');
        const updated = await prisma.jointIntegrityItem.update({
            where: { id, organization_id: organizationId },
            data: { status: 'assembled', assembled_by: userId, assembled_at: assembledAt ?? new Date(), updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'JointIntegrityItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async markInspected(id: string, organizationId: string, userId: string, inspectedAt?: Date) {
        const oldValues = await prisma.jointIntegrityItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Joint not found');
        const updated = await prisma.jointIntegrityItem.update({
            where: { id, organization_id: organizationId },
            data: { status: 'inspected', inspected_by: userId, inspected_at: inspectedAt ?? new Date(), updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'JointIntegrityItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async signOff(id: string, organizationId: string, userId: string, signOffAt?: Date) {
        const oldValues = await prisma.jointIntegrityItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Joint not found');
        const updated = await prisma.jointIntegrityItem.update({
            where: { id, organization_id: organizationId },
            data: { status: 'signed_off', signed_off_by: userId, signed_off_at: signOffAt ?? new Date(), updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'JointIntegrityItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async dismantle(id: string, organizationId: string, userId: string) {
        const oldValues = await prisma.jointIntegrityItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Joint not found');
        const updated = await prisma.jointIntegrityItem.update({
            where: { id, organization_id: organizationId },
            data: { status: 'dismantled', updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'JointIntegrityItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async getSummary(workpackId: string, organizationId: string) {
        const groups = await prisma.jointIntegrityItem.groupBy({
            by: ['status'],
            where: { workpack_id: workpackId, organization_id: organizationId, deleted_at: null },
            _count: { id: true },
        });
        const result: Record<string, number> = { pending: 0, assembled: 0, inspected: 0, signed_off: 0, dismantled: 0 };
        for (const g of groups) {
            if (g.status) result[g.status] = g._count.id;
        }
        return { ...result, total: Object.values(result).reduce((a, b) => a + b, 0) };
    }

    static async deleteJoint(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.jointIntegrityItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Joint not found');
        const updated = await prisma.jointIntegrityItem.update({ where: { id, organization_id: organizationId }, data: { deleted_at: new Date() } });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'JointIntegrityItem',
            model_id: id,
            old_values: oldValues as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
            site_id: oldValues.site_id ?? undefined,
        });
        return updated;
    }
}
