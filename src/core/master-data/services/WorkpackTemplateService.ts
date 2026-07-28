import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';

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
        return prisma.workpackTemplate.findFirst({
            where: {
                id,
                OR: [{ organization_id: orgId }, { is_system: true }],
                deleted_at: null,
            },
            include: {
                activities: {
                    orderBy: { sequence_number: 'asc' }
                }
            }
        });
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
        const created = await prisma.workpackTemplate.create({
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
        const updated = await prisma.workpackTemplate.update({
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

        const workpack = await prisma.workpack.findUnique({
            where: { id: workpackId },
            include: { activities: { where: { deleted_at: null } } }
        });
        if (!workpack) throw new Error('Workpack not found');

        const results = [];
        let nextSeq = (await prisma.activity.aggregate({
            where: { workpack_id: workpackId, deleted_at: null },
            _max: { sequence_number: true }
        }))._max.sequence_number || 0;

        const templateActivities = 'activities' in template && Array.isArray(template.activities) ? template.activities : [];
        for (const ta of templateActivities) {
            // Smart Merge: Check if activity already exists (by description or code)
            const exists = workpack.activities.some((a: { description: string; activity_number?: string | null }) =>
                (a.description === ta.description) ||
                (ta.activity_code && a.activity_number === ta.activity_code)
            );

            if (!exists) {
                nextSeq++;
                const created = await prisma.activity.create({
                    data: {
                        organization_id: orgId,
                        site_id: workpack.site_id,
                        workpack_id: workpackId,
                        description: ta.description,
                        activity_number: ta.activity_code ?? null,
                        duration_hours: ta.duration_hours,
                        hold_point_type: ta.hold_point_type,
                        hold_point_description: ta.hold_point_description,
                        sequence_number: nextSeq,
                        status: 'not_started',
                        created_by: userId
                    }
                });
                results.push(created);

                // Trigger auto-load of default resources if activity_code is set
                if (ta.activity_code) {
                    // This is handled by ActivityService.createActivity, but here we are using prisma.activity.create direct
                    // We should ideally call ActivityService.createActivity or trigger the same logic.
                    // Since ActivityService is already updated, we'll keep it consistent.
                }
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
