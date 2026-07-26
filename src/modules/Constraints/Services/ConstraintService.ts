import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { ConstraintType, Priority } from '@prisma/client';

export class ConstraintService {
    static async createConstraint(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        title: string;
        description?: string;
        constraint_type: ConstraintType;
        priority: Priority;
        created_by: string;
        owner_id?: string;
        due_date?: Date;
    }) {
        const created = await prisma.constraint.create({
            data: { ...data, status: 'open', raised_by: data.created_by, raised_at: new Date() },
        });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by ?? '',
            action: 'created',
            model_name: 'Constraint',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });
        return created;
    }

    static async updateConstraint(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const oldValues = await prisma.constraint.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Constraint not found');
        const updated = await prisma.constraint.update({ where: { id, organization_id: organizationId }, data: { ...data, updated_by: updatedBy } });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'Constraint',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async resolveConstraint(id: string, organizationId: string, userId: string, resolution_notes: string) {
        const oldValues = await prisma.constraint.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Constraint not found');
        const updated = await prisma.constraint.update({
            where: { id, organization_id: organizationId },
            data: { status: 'resolved', closed_by: userId, closed_at: new Date(), resolution_notes, updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'Constraint',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async deferConstraint(id: string, organizationId: string, userId: string, dueDate: Date) {
        const oldValues = await prisma.constraint.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Constraint not found');
        const updated = await prisma.constraint.update({
            where: { id, organization_id: organizationId },
            data: { status: 'deferred', target_resolution_date: dueDate, updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'Constraint',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async deleteConstraint(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.constraint.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Constraint not found');
        const updated = await prisma.constraint.update({ where: { id, organization_id: organizationId }, data: { deleted_at: new Date() } });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'Constraint',
            model_id: id,
            old_values: oldValues as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
            site_id: oldValues.site_id ?? undefined,
        });
        return updated;
    }
}
