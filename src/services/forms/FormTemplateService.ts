import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { enqueueKnowledgeCapture, formTemplateCategory } from '@/core/knowledge-engine/capture';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export interface FormTemplateInput {
    organization_id: string;
    name: string;
    slug: string;
    form_type: string;
    description?: string;
    schema_json: any;
    requires_approval?: boolean;
    created_by: string;
}

export class FormTemplateService {
    /**
     * Validate a JSON Schema definition.
     */
    static validateSchemaDefinition(schema: any) {
        try {
            ajv.compile(schema);
            return true;
        } catch (error: any) {
            throw new Error(`Invalid JSON Schema: ${error.message}`);
        }
    }

    /**
     * Create a new form template with an initial version.
     */
    static async create(input: FormTemplateInput) {
        this.validateSchemaDefinition(input.schema_json);

        const template = await prisma.$transaction(async (tx) => {
            const id = uuidv4();
            
            const newTemplate = await tx.formTemplate.create({
                data: {
                    id,
                    organization_id: input.organization_id,
                    name: input.name,
                    slug: input.slug,
                    form_type: input.form_type,
                    description: input.description,
                    schema_json: input.schema_json,
                    requires_approval: input.requires_approval ?? false,
                    current_version: 1,
                    created_by: input.created_by,
                },
            });

            await tx.formTemplateVersion.create({
                data: {
                    id: uuidv4(),
                    organization_id: input.organization_id,
                    form_template_id: id,
                    version_number: 1,
                    schema_json: input.schema_json,
                    created_by: input.created_by,
                },
            });

            return newTemplate;
        });

        await AuditService.log({
            organization_id: input.organization_id,
            user_id: input.created_by,
            action: 'created',
            model_name: 'FormTemplate',
            model_id: template.id,
            new_values: template,
        });

        enqueueKnowledgeCapture({
            organizationId: input.organization_id,
            category: formTemplateCategory(template.form_type),
            assetType: 'FormTemplate',
            title: template.name,
            payload: template as unknown as Record<string, unknown>,
        });

        return template;
    }

    /**
     * Update a template and bump its version. Old version becomes immutable.
     */
    static async update(id: string, organizationId: string, input: Partial<FormTemplateInput>, userId: string) {
        const current = await prisma.formTemplate.findFirst({
            where: { id, organization_id: organizationId, deleted_at: null },
        });

        if (!current) throw new Error('Form template not found');

        if (input.schema_json) {
            this.validateSchemaDefinition(input.schema_json);
        }

        const nextVersion = current.current_version + 1;

        const updated = await prisma.$transaction(async (tx) => {
            const up = await tx.formTemplate.update({
                where: { id },
                data: {
                    name: input.name ?? current.name,
                    description: input.description ?? current.description,
                    schema_json: input.schema_json ?? current.schema_json,
                    requires_approval: input.requires_approval ?? current.requires_approval,
                    current_version: nextVersion,
                },
            });

            await tx.formTemplateVersion.create({
                data: {
                    id: uuidv4(),
                    organization_id: organizationId,
                    form_template_id: id,
                    version_number: nextVersion,
                    schema_json: input.schema_json ?? current.schema_json,
                    created_by: userId,
                    change_notes: (input as any).change_notes ?? 'Version bump',
                },
            });

            return up;
        });

        await AuditService.log({
            organization_id: organizationId,
            user_id: userId,
            action: 'updated',
            model_name: 'FormTemplate',
            model_id: id,
            old_values: current,
            new_values: updated,
        });

        enqueueKnowledgeCapture({
            organizationId: organizationId,
            category: formTemplateCategory(updated.form_type),
            assetType: 'FormTemplate',
            title: updated.name,
            payload: updated as unknown as Record<string, unknown>,
        });

        return updated;
    }

    /**
     * Get a template by ID, optionally at a specific version.
     */
    static async get(id: string, organizationId: string, version?: number) {
        const template = await prisma.formTemplate.findFirst({
            where: { id, organization_id: organizationId, deleted_at: null },
        });

        if (!template) return null;

        if (version && version !== template.current_version) {
            const historical = await prisma.formTemplateVersion.findFirst({
                where: { form_template_id: id, version_number: version },
            });
            if (historical) {
                return {
                    ...template,
                    schema_json: historical.schema_json,
                    current_version: historical.version_number,
                };
            }
        }

        return template;
    }

    /**
     * List templates with filters.
     */
    static async list(filters: {
        organization_id: string;
        form_type?: string;
        is_active?: boolean;
        page?: number;
        limit?: number;
    }) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;

        const where = {
            organization_id: filters.organization_id,
            deleted_at: null,
            ...(filters.form_type && { form_type: filters.form_type }),
            ...(filters.is_active !== undefined && { is_active: filters.is_active }),
        };

        const [items, total] = await Promise.all([
            prisma.formTemplate.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.formTemplate.count({ where }),
        ]);

        return {
            items,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Archive a template (soft delete logic using is_active flag).
     */
    static async archive(id: string, organizationId: string, userId: string) {
        const template = await prisma.formTemplate.update({
            where: { id, organization_id: organizationId },
            data: { is_active: false },
        });

        await AuditService.log({
            organization_id: organizationId,
            user_id: userId,
            action: 'archived',
            model_name: 'FormTemplate',
            model_id: id,
        });

        return template;
    }
}
