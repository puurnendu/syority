import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { PunchCategory } from '@prisma/client';

export class PunchListService {
    static async createItem(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        title: string;
        category: PunchCategory;
        description?: string;
        created_by: string;
        raised_by: string;
        discipline_id?: string;
        activity_id?: string;
        location?: string;
        target_close_date?: Date;
    }) {
        const created = await prisma.punchListItem.create({
            data: {
                id: crypto.randomUUID(),
                ...data,
                status: 'open',
                raised_at: new Date(),
                updated_at: new Date(),
            },
        });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by ?? '',
            action: 'created',
            model_name: 'PunchListItem',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });
        return created;
    }

    static async closeItem(id: string, organizationId: string, userId: string, resolution_notes: string) {
        const oldValues = await prisma.punchListItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Punch list item not found');
        const updated = await prisma.punchListItem.update({
            where: { id, organization_id: organizationId },
            data: { status: 'closed', closed_by: userId, closed_at: new Date(), close_out_notes: resolution_notes, updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'PunchListItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async acceptItem(id: string, organizationId: string, userId: string, comments?: string) {
        const oldValues = await prisma.punchListItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Punch list item not found');
        const updated = await prisma.punchListItem.update({
            where: { id, organization_id: organizationId },
            data: { status: 'accepted_with_comments', accepted_by: userId, accepted_at: new Date(), close_out_notes: comments ?? undefined, updated_by: userId },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: userId,
            action: 'updated',
            model_name: 'PunchListItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async updateItem(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const oldValues = await prisma.punchListItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Punch list item not found');
        const updated = await prisma.punchListItem.update({ where: { id, organization_id: organizationId }, data: { ...data, updated_by: updatedBy } });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'PunchListItem',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async deleteItem(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.punchListItem.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Punch list item not found');
        const updated = await prisma.punchListItem.update({ where: { id, organization_id: organizationId }, data: { deleted_at: new Date() } });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'PunchListItem',
            model_id: id,
            old_values: oldValues as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
            site_id: oldValues.site_id ?? undefined,
        });
        return updated;
    }

    /** Returns true if workpack can be closed (no open Cat-A items) */
    static async validateClosureEligibility(workpackId: string, organizationId: string): Promise<{ eligible: boolean; blockers: string[] }> {
        const openCatA = await prisma.punchListItem.count({
            where: { workpack_id: workpackId, organization_id: organizationId, category: 'A', status: { not: 'closed' }, deleted_at: null },
        });
        const blockers = openCatA > 0 ? [`${openCatA} open Category A punch item(s)`] : [];
        return { eligible: openCatA === 0, blockers };
    }
}
