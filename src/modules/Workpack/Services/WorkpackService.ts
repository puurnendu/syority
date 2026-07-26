import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { isUuid, normalizeUuid, normalizeUuidFromSegment } from '@/lib/uuid';
import type { WorkpackStatus } from '@prisma/client';

export class WorkpackService {
    // ── Generate workpack number ─────────────────────────────────────────────
    static async generateWorkpackNumber(orgId: string): Promise<string> {
        const year = new Date().getFullYear();
        const settings = await prisma.organizationDocumentSetting.findUnique({
            where: { organization_id: orgId },
        });
        const prefix = settings?.number_prefix ?? 'WP';

        // Use max existing sequence (not count) to avoid collisions when numbering has gaps.
        // Format is expected to be: {PREFIX}-{YEAR}-{SEQ(5 digits)}
        const last = await prisma.workpack.findFirst({
            where: {
                organization_id: orgId,
                workpack_number: { startsWith: `${prefix}-${year}-` },
            },
            orderBy: { workpack_number: 'desc' },
            select: { workpack_number: true },
        });

        const lastNum = last?.workpack_number
            ? Number.parseInt(last.workpack_number.split('-').at(-1) ?? '0', 10)
            : 0;

        const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
        const seq = String(nextNum).padStart(5, '0');
        return `${prefix}-${year}-${seq}`;
    }

    // ── Create ──────────────────────────────────────────────────────────────
    static async createWorkpack(data: {
        organization_id: string;
        site_id: string;
        title: string;
        created_by: string;
        workpack_number?: string;
        sap_work_order?: string;
        sap_notification?: string;
        asset_id?: string;
        unit_id?: string;
        discipline_id?: string;
        contractor_id?: string;
        work_type?: string;
        priority?: string;
        scope_of_work?: string;
        planned_start_date?: Date;
        planned_end_date?: Date;
        estimated_manhours?: number;
        status?: WorkpackStatus;
        unit_code?: string | null;
        portfolio_id?: string | null;
        equipment_type?: string | null;
        project_id?: string | null;
    }) {
        // Retry a couple times to avoid collisions with concurrent AI generations.
        let created: Awaited<ReturnType<typeof prisma.workpack.create>> | null = null;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            let workpack_number: string | undefined;

            if (data.status === 'pending_ai_review') {
                workpack_number = undefined;
            } else if (data.workpack_number && data.workpack_number.trim()) {
                workpack_number = data.workpack_number.trim();

                const exists = await prisma.workpack.findFirst({
                    where: {
                        organization_id: data.organization_id,
                        workpack_number,
                        deleted_at: null,
                    },
                    select: { id: true },
                });
                if (exists) {
                    throw new Error('This workpack number already exists in your organization.');
                }
            } else {
                workpack_number = await this.generateWorkpackNumber(data.organization_id);
            }

            try {
                created = await prisma.workpack.create({
                    data: {
                        organization_id: data.organization_id,
                        site_id: data.site_id,
                        title: data.title,
                        created_by: data.created_by,
                        workpack_number,
                        revision: 'R0',
                        status: data.status ?? 'draft',
                        sap_work_order: data.sap_work_order ?? null,
                        sap_notification: data.sap_notification ?? null,
                        asset_id: normalizeUuid(data.asset_id),
                        unit_id: normalizeUuid(data.unit_id),
                        discipline_id: normalizeUuid(data.discipline_id),
                        contractor_id: normalizeUuid(data.contractor_id),
                        work_type: data.work_type ?? null,
                        priority: data.priority ?? null,
                        scope_of_work: data.scope_of_work ?? null,
                        planned_start_date: data.planned_start_date ?? null,
                        planned_end_date: data.planned_end_date ?? null,
                        estimated_manhours: data.estimated_manhours ?? null,
                        unit_code: data.unit_code ?? null,
                        portfolio_id: data.portfolio_id ?? null,
                        project_id: data.project_id ?? null,
                        equipment_type: data.equipment_type ?? null,
                    },
                });
                break;
            } catch (err: unknown) {
                const code = (err as any)?.code;
                if (code === 'P2002' && attempt < maxAttempts) {
                    // Unique constraint (likely workpack_number). Retry with fresh generated number.
                    continue;
                }
                throw err;
            }
        }

        if (!created) throw new Error('Failed to create workpack after retries');

        await AuditService.log({
            organization_id: data.organization_id,
            site_id: data.site_id,
            user_id: data.created_by,
            model_name: 'Workpack',
            model_id: created.id,
            action: 'created',
            new_values: created,
        });

        eventBus.emit('WorkpackCreated', {
            workpack_id: created.id,
            organization_id: created.organization_id,
            created_by: created.created_by,
        });

        return created;
    }

    // ── Get one with all relations (scoped by organization) ─────────────────
    static async getWorkpack(id: string, organizationId: string) {
        const normId = normalizeUuidFromSegment(id);
        const normOrgId = normalizeUuidFromSegment(organizationId);
        if (!isUuid(normId) || !isUuid(normOrgId)) return null;

        // Query by id only; enforce org in app (avoids DB column mismatch, multi-tenant safe).
        // If you see P2022 "column does not exist", run: npx prisma migrate deploy && npx prisma generate
        const workpack = await prisma.workpack.findFirst({
            where: { id: normId },
            include: {
                site: true,
                asset: true,
                unit: true,
                discipline: true,
                contractor: true,
                User_Workpack_created_byToUser: { select: { id: true, name: true, email: true } },
                organization: { select: { feature_flags: true } },
                activities: {
                    where: { deleted_at: null },
                    orderBy: { sequence_number: 'asc' },
                    include: {
                        discipline: true,
                    },
                },
                workpack_materials: {
                    where: { deleted_at: null },
                    include: { organization: true },
                    orderBy: { created_at: 'asc' },
                },
                workpack_documents: {
                    where: { deleted_at: null },
                    orderBy: { created_at: 'asc' },
                },
                versions: {
                    orderBy: { created_at: 'desc' },
                },
                joint_integrity_items: {
                    where: { deleted_at: null },
                    orderBy: { joint_number: 'asc' },
                },
                blinds: {
                    where: { deleted_at: null },
                    orderBy: { blind_number: 'asc' },
                },
            },
        });
        if (!workpack || workpack.organization_id !== normOrgId) return null;
        return workpack;
    }

    // ── Get list ─────────────────────────────────────────────────────────────
    static async getWorkpacks(orgId: string, filters?: {
        site_id?: string;
        system_id?: string;
        project_id?: string;
        status?: WorkpackStatus;
        search?: string;
    }) {
        return prisma.workpack.findMany({
            where: {
                organization_id: orgId,
                deleted_at: null,
                ...(filters?.site_id && { site_id: filters.site_id }),
                ...(filters?.system_id && { system_id: filters.system_id }),
                ...(filters?.project_id && { project_id: filters.project_id }),
                ...(filters?.status && { status: filters.status }),
                ...(filters?.search && {
                    OR: [
                        { title: { contains: filters.search, mode: 'insensitive' } },
                        { workpack_number: { contains: filters.search, mode: 'insensitive' } },
                        { sap_work_order: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                site: { select: { id: true, name: true } },
                discipline: { select: { id: true, name: true, code: true, color: true } },
                User_Workpack_created_byToUser: { select: { id: true, name: true } },
            },
            orderBy: { created_at: 'desc' },
        });
    }

    // ── Update (scoped by organization) ─────────────────────────────────────
    static async updateWorkpack(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const oldValues = await prisma.workpack.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Workpack not found');
        if (oldValues.is_locked) throw new Error('Workpack is locked. Cannot edit.');
        const updated = await prisma.workpack.update({
            where: { id, organization_id: organizationId },
            data: { ...data, updated_by: updatedBy },
        });
        await AuditService.log({
            organization_id: updated.organization_id,
            site_id: updated.site_id,
            user_id: updatedBy,
            model_name: 'Workpack',
            model_id: id,
            action: 'updated',
            old_values: oldValues,
            new_values: updated,
        });
        return updated;
    }

    // ── Soft delete (scoped by organization) ─────────────────────────────────
    static async deleteWorkpack(id: string, organizationId: string, deletedBy: string) {
        const oldValues = await prisma.workpack.findFirst({ where: { id, organization_id: organizationId } });
        if (!oldValues) throw new Error('Workpack not found');
        const updated = await prisma.workpack.update({
            where: { id, organization_id: organizationId },
            data: { deleted_at: new Date() },
        });
        await AuditService.log({
            organization_id: oldValues.organization_id,
            site_id: oldValues.site_id,
            user_id: deletedBy,
            model_name: 'Workpack',
            model_id: id,
            action: 'deleted',
            old_values: oldValues,
            new_values: updated,
        });
        return updated;
    }

    // ── Clone ──────────────────────────────────────────────────────────────
    /**
     * Clone a workpack into a new draft.
     * Copies: core fields, activities, materials, tools.
     * Does NOT copy: joints, blinds, clearances, certificates, punch items, attachments
     * (these are execution-specific to the original physical asset).
     */
    static async cloneWorkpack(
        sourceId: string,
        organizationId: string,
        clonedBy: string,
        titleOverride?: string,
    ) {
        const source = await prisma.workpack.findFirst({
            where: { id: sourceId, organization_id: organizationId, deleted_at: null },
            include: {
                activities: { where: { deleted_at: null }, orderBy: { sequence_number: 'asc' } },
                workpack_materials: { where: { deleted_at: null }, orderBy: { created_at: 'asc' } },
            },
        });
        if (!source) throw new Error('Source workpack not found');

        // Tools have no @relation on Workpack model — fetch separately
        const tools = await prisma.workpackTool.findMany({
            where: { workpack_id: sourceId },
        });

        const newNumber = await this.generateWorkpackNumber(organizationId);
        const newTitle = titleOverride?.trim() || `Copy of ${source.title}`;

        const clone = await prisma.$transaction(async (tx) => {
            // Create the new workpack
            const cloned = await tx.workpack.create({
                data: {
                    organization_id: source.organization_id,
                    site_id: source.site_id,
                    title: newTitle,
                    workpack_number: newNumber,
                    revision: 'R0',
                    status: 'draft',
                    created_by: clonedBy,
                    asset_id: source.asset_id,
                    unit_id: source.unit_id,
                    discipline_id: source.discipline_id,
                    contractor_id: source.contractor_id,
                    work_type: source.work_type,
                    priority: source.priority,
                    scope_of_work: source.scope_of_work,
                    estimated_manhours: source.estimated_manhours,
                    unit_code: source.unit_code,
                    portfolio_id: source.portfolio_id,
                    equipment_type: source.equipment_type,
                    // deliberately omit: sap_work_order, sap_notification, planned dates, is_locked
                },
            });

            // Copy activities
            if (source.activities?.length) {
                await tx.activity.createMany({
                    data: source.activities.map((a) => ({
                        organization_id: cloned.organization_id,
                        site_id: cloned.site_id,
                        workpack_id: cloned.id,
                        activity_code: (a as any).activity_code,
                        description: a.description,
                        sequence_number: a.sequence_number,
                        planned_duration_hours: (a as any).planned_duration_hours,
                        discipline_id: a.discipline_id,
                        status: 'not_started' as any,
                    })),
                });
            }

            // Copy materials (match WorkpackMaterial schema field names)
            if (source.workpack_materials?.length) {
                await tx.workpackMaterial.createMany({
                    data: source.workpack_materials.map((m) => ({
                        organization_id: cloned.organization_id,
                        site_id: cloned.site_id,
                        workpack_id: cloned.id,
                        description: m.description,
                        unit_of_measure: m.unit_of_measure,
                        quantity_required: m.quantity_required,
                        material_category: m.material_category,
                        item_catalog_id: m.item_catalog_id,
                        material_number: m.material_number,
                        specifications: m.specifications,
                        is_critical: m.is_critical,
                        notes: m.notes,
                        status: 'pending' as any,
                    })),
                });
            }

            // Copy tools (match WorkpackTool schema field names)
            if (tools.length) {
                await tx.workpackTool.createMany({
                    data: tools.map((t) => ({
                        organization_id: cloned.organization_id,
                        workpack_id: cloned.id,
                        category: t.category,
                        name: t.name,
                        description: t.description,
                        quantity: t.quantity,
                        unit: t.unit,
                        tool_type: t.tool_type,
                        cert_required: t.cert_required,
                        notes: t.notes,
                    })),
                });
            }

            return cloned;
        });

        // Audit both source and clone
        await AuditService.log({
            organization_id: organizationId,
            site_id: source.site_id,
            user_id: clonedBy,
            model_name: 'Workpack',
            model_id: sourceId,
            action: 'cloned',
            new_values: { cloned_to: clone.id, cloned_to_number: clone.workpack_number },
        });
        await AuditService.log({
            organization_id: organizationId,
            site_id: clone.site_id,
            user_id: clonedBy,
            model_name: 'Workpack',
            model_id: clone.id,
            action: 'created',
            new_values: { cloned_from: sourceId, cloned_from_number: source.workpack_number },
        });

        eventBus.emit('WorkpackCreated', {
            workpack_id: clone.id,
            organization_id: clone.organization_id,
            created_by: clonedBy,
        });

        return clone;
    }

}
