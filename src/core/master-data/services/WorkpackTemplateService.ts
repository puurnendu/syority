import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';
import { createActivity } from '@/core/activity/ActivityCreationCommand';

export class WorkpackTemplateService {
    // ── CRUD Operations ──────────────────────────────────────────────────────

    static async getTemplates(orgId: string) {
        // Schema model is `workpack_templates` (no Prisma relation includes).
        return prisma.workpack_templates.findMany({
            where: {
                OR: [{ organization_id: orgId }, { is_system: true }],
                deleted_at: null,
                is_active: true,
            },
            orderBy: [{ is_system: 'asc' }, { name: 'asc' }],
        });
    }

    static async getTemplate(id: string, orgId: string) {
        const template = await prisma.workpack_templates.findFirst({
            where: {
                id,
                OR: [{ organization_id: orgId }, { is_system: true }],
                deleted_at: null,
            },
        });
        if (!template) return null;
        const activities = await prisma.workpack_template_activities.findMany({
            where: { template_id: id },
            orderBy: { sequence_number: 'asc' },
        });
        return { ...template, activities };
    }

    static async createTemplate(data: {
        organization_id: string;
        name: string;
        description?: string;
        equipment_type?: string;
        job_type?: string;
        discipline_id?: string;
        created_by: string;
    }) {
        const created = await prisma.workpack_templates.create({
            data: {
                organization_id: data.organization_id,
                name: data.name,
                description: data.description ?? null,
                equipment_type: data.equipment_type ?? 'General',
                job_type: data.job_type ?? 'General',
                created_by: data.created_by,
            },
        });
        await AuditService.log({
            organization_id: data.organization_id,
            user_id: data.created_by,
            action: 'created',
            model_name: 'WorkpackTemplate',
            model_id: created.id,
            new_values: created as Record<string, unknown>,
        });
        enqueueKnowledgeCapture({
            organizationId: data.organization_id,
            category: 'WORKPACK_TEMPLATE',
            assetType: 'workpack_templates',
            title: created.name,
            payload: created as unknown as Record<string, unknown>,
        });
        return created;
    }

    static async updateTemplate(id: string, orgId: string, data: any, userId: string) {
        const updated = await prisma.workpack_templates.update({
            where: { id, organization_id: orgId },
            data
        });
        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'updated',
            model_name: 'WorkpackTemplate',
            model_id: id,
            new_values: data as Record<string, unknown>,
        });
        enqueueKnowledgeCapture({
            organizationId: orgId,
            category: 'WORKPACK_TEMPLATE',
            assetType: 'workpack_templates',
            title: updated.name,
            payload: updated as unknown as Record<string, unknown>,
        });
        return updated;
    }

    // ── Smart Merge Logic ──────────────────────────────────────────────────
    // V5 Requirement: "Apply Template" should merge activities without duplication

    static async applyTemplate(workpackId: string, templateId: string, orgId: string, userId: string) {
        const template = await this.getTemplate(templateId, orgId);
        if (!template) throw new Error('Template not found');

        const workpack = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId, deleted_at: null },
            include: { activities: { where: { deleted_at: null } } }
        });
        if (!workpack) throw new Error('Workpack not found');

        const results = [];
        let nextSeq = (await prisma.activity.aggregate({
            where: { workpack_id: workpackId, deleted_at: null },
            _max: { sequence_number: true }
        }))._max.sequence_number || 0;

        const templateActivities = Array.isArray(template.activities) ? template.activities : [];
        for (const ta of templateActivities) {
            const exists = workpack.activities.some((a: { description: string; activity_number?: string | null }) =>
                (a.description === ta.description) ||
                (ta.activity_code && a.activity_number === ta.activity_code)
            );

            if (!exists) {
                nextSeq++;
                const created = await createActivity(
                    {
                        organizationId: orgId,
                        userId,
                        sourceChannel: 'template',
                        eventId: workpack.event_id,
                    },
                    {
                        workpackId,
                        description: ta.description,
                        activityNumber: ta.activity_code ?? null,
                        activityCode: ta.activity_code,
                        durationHours: ta.duration_hours != null ? Number(ta.duration_hours) : undefined,
                        holdPointType: ta.hold_point_type,
                        holdPointDescription: ta.hold_point_description,
                        sequenceNumber: nextSeq,
                        disciplineId: template.discipline_id,
                        equipmentType: template.equipment_type || workpack.equipment_type,
                        templateId,
                    }
                );
                results.push(created);
            }
        }

        // Update workpack with template info
        await prisma.workpack.update({
            where: { id: workpackId },
            data: {
                template_id: templateId,
                equipment_type: template.equipment_type || workpack.equipment_type,
                job_type: template.job_type || workpack.job_type
            }
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'updated',
            model_name: 'Workpack',
            model_id: workpackId,
            new_values: { templateId, addedCount: results.length },
        });

        return results;
    }
}
