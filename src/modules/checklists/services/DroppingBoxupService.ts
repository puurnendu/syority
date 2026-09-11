import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { ChecklistType } from '@prisma/client';

type AddItemData = { description: string; responsible_party?: string; sequence_number?: number };
type UpdateItemData = { is_done?: boolean; signed_by?: string | null; signed_at?: Date | null; notes?: string | null };

async function fetchChecklistWithItems(id: string, orgId: string) {
    const checklist = await prisma.dropping_boxup_checklists.findFirst({
        where: { id, organization_id: orgId },
    });
    if (!checklist) return null;
    const items = await prisma.dropping_boxup_checklist_items.findMany({
        where: { checklist_id: id, organization_id: orgId },
        orderBy: { sequence_number: 'asc' },
    });
    return { ...checklist, items };
}

export class DroppingBoxupService {
    // ── Dropping ──────────────────────────────────────────────────────────
    static async getChecklist(workpackId: string, orgId: string) {
        const checklist = await prisma.dropping_boxup_checklists.findFirst({
            where: { workpack_id: workpackId, organization_id: orgId, checklist_type: ChecklistType.dropping },
        });
        if (!checklist) return null;
        const items = await prisma.dropping_boxup_checklist_items.findMany({
            where: { checklist_id: checklist.id, organization_id: orgId },
            orderBy: { sequence_number: 'asc' },
        });
        return { ...checklist, items };
    }

    static async createChecklist(workpackId: string, orgId: string, userId: string) {
        const created = await prisma.dropping_boxup_checklists.create({
            data: { organization_id: orgId, workpack_id: workpackId, checklist_type: ChecklistType.dropping, created_by: userId },
        });
        await AuditService.log({ organization_id: orgId, user_id: userId, action: 'created', model_name: 'DroppingBoxupChecklist', model_id: created.id, new_values: created as Record<string, unknown> });
        return { ...created, items: [] };
    }

    // ── Box-up ────────────────────────────────────────────────────────────
    static async getBoxUpChecklist(workpackId: string, orgId: string) {
        const checklist = await prisma.dropping_boxup_checklists.findFirst({
            where: { workpack_id: workpackId, organization_id: orgId, checklist_type: ChecklistType.boxup },
        });
        if (!checklist) return null;
        const items = await prisma.dropping_boxup_checklist_items.findMany({
            where: { checklist_id: checklist.id, organization_id: orgId },
            orderBy: { sequence_number: 'asc' },
        });
        return { ...checklist, items };
    }

    static async createBoxUpChecklist(workpackId: string, orgId: string, userId: string) {
        const created = await prisma.dropping_boxup_checklists.create({
            data: { organization_id: orgId, workpack_id: workpackId, checklist_type: ChecklistType.boxup, created_by: userId },
        });
        await AuditService.log({ organization_id: orgId, user_id: userId, action: 'created', model_name: 'DroppingBoxupChecklist', model_id: created.id, new_values: { checklist_type: 'boxup', workpack_id: workpackId } });
        return { ...created, items: [] };
    }

    // ── Shared ────────────────────────────────────────────────────────────
    static async updateChecklist(id: string, orgId: string, data: Record<string, unknown>, userId: string) {
        const updated = await prisma.dropping_boxup_checklists.update({ where: { id, organization_id: orgId }, data });
        await AuditService.log({ organization_id: orgId, user_id: userId, action: 'updated', model_name: 'DroppingBoxupChecklist', model_id: id, new_values: data });
        return updated;
    }

    static async addItems(checklistId: string, orgId: string, items: AddItemData[]) {
        return this.addItemsToChecklist(checklistId, orgId, items);
    }

    static async addItemsToChecklist(checklistId: string, orgId: string, items: AddItemData[]) {
        const existing = await prisma.dropping_boxup_checklist_items.findMany({ where: { checklist_id: checklistId, organization_id: orgId } });
        const startSeq = (existing?.length ?? 0) + 1;
        await prisma.dropping_boxup_checklist_items.createMany({
            data: items.map((item, i) => ({
                organization_id: orgId,
                checklist_id: checklistId,
                sequence_number: item.sequence_number ?? startSeq + i,
                description: item.description,
                responsible_party: item.responsible_party ?? null,
            })),
        });
        return fetchChecklistWithItems(checklistId, orgId);
    }

    static async updateItem(itemId: string, orgId: string, _userId: string, data: UpdateItemData) {
        return prisma.dropping_boxup_checklist_items.update({
            where: { id: itemId, organization_id: orgId },
            data: {
                ...(data.is_done !== undefined ? { is_done: data.is_done } : {}),
                ...(data.signed_by !== undefined ? { signed_by: data.signed_by } : {}),
                ...(data.signed_at !== undefined ? { signed_at: data.signed_at } : {}),
                ...(data.notes !== undefined ? { notes: data.notes } : {}),
            },
        });
    }

    static async addSignOff(_checklistId: string, orgId: string, _role: string, userId: string) {
        await AuditService.log({ organization_id: orgId, user_id: userId, action: 'updated', model_name: 'DroppingBoxupChecklist', model_id: _checklistId, new_values: { role: _role } });
        return null;
    }
}
