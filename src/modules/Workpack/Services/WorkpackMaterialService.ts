import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

export class WorkpackMaterialService {
    static async addFromCatalog(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        item_catalog_id: string;
        quantity_required: number;
        activity_id?: string;
        required_date?: Date;
        is_critical?: boolean;
        notes?: string;
        material_category?: string;
        created_by: string;
    }) {
        const item = await prisma.itemCatalog.findFirst({
            where: { id: data.item_catalog_id, organization_id: data.organization_id, deleted_at: null },
        });
        if (!item) throw new Error('Item not found in catalog');
        const created = await prisma.workpackMaterial.create({
            data: {
                organization_id: data.organization_id,
                site_id: data.site_id,
                workpack_id: data.workpack_id,
                item_catalog_id: data.item_catalog_id,
                activity_id: data.activity_id,
                required_date: data.required_date,
                is_critical: data.is_critical,
                notes: data.notes,
                created_by: data.created_by,
                material_number: item.item_code ?? undefined,
                description: item.description,
                unit_of_measure: item.unit_of_measure,
                unit_cost: item.unit_cost ?? undefined,
                quantity_required: data.quantity_required,
                material_category: data.material_category || 'mechanical',
                status: 'pending',
            },
        });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by ?? '',
            action: 'created',
            model_name: 'WorkpackMaterial',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });
        return created;
    }

    static async addAdHoc(data: {
        organization_id: string;
        site_id: string;
        workpack_id: string;
        description: string;
        unit_of_measure: string;
        quantity_required: number;
        material_number?: string;
        specifications?: string;
        activity_id?: string;
        required_date?: Date;
        is_critical?: boolean;
        notes?: string;
        material_category?: string;
        created_by: string;
    }) {
        const created = await prisma.workpackMaterial.create({
            data: { ...data, material_category: data.material_category || 'mechanical', status: 'pending' },
        });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by ?? '',
            action: 'created',
            model_name: 'WorkpackMaterial',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
            site_id: data.site_id,
        });
        return created;
    }

    static async updateMaterial(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const oldValues = await prisma.workpackMaterial.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Material not found');
        const updated = await prisma.workpackMaterial.update({
            where: { id, organization_id: organizationId },
            data: { ...data, updated_by: updatedBy },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'WorkpackMaterial',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async issueMaterial(id: string, organizationId: string, quantity: number, reference: string, updatedBy: string) {
        const oldValues = await prisma.workpackMaterial.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Material not found');
        const updated = await prisma.workpackMaterial.update({
            where: { id, organization_id: organizationId },
            data: { quantity_issued: quantity, issue_reference: reference, status: 'issued', updated_by: updatedBy },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'WorkpackMaterial',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async returnMaterial(id: string, organizationId: string, quantity: number, updatedBy: string) {
        const oldValues = await prisma.workpackMaterial.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Material not found');
        const updated = await prisma.workpackMaterial.update({
            where: { id, organization_id: organizationId },
            data: { quantity_returned: quantity, status: 'returned', updated_by: updatedBy },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            user_id: updatedBy,
            action: 'updated',
            model_name: 'WorkpackMaterial',
            model_id: id,
            old_values: oldValues,
            new_values: updated,
            site_id: updated.site_id ?? undefined,
        });
        return updated;
    }

    static async deleteMaterial(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.workpackMaterial.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Material not found');
        const updated = await prisma.workpackMaterial.update({ where: { id, organization_id: organizationId }, data: { deleted_at: new Date() } });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            user_id: deletedBy,
            action: 'deleted',
            model_name: 'WorkpackMaterial',
            model_id: id,
            old_values: oldValues as Record<string, unknown>,
            new_values: updated as Record<string, unknown>,
            site_id: oldValues.site_id ?? undefined,
        });
        return updated;
    }
}
