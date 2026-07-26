import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export class FormInstanceService {
    /**
     * Create a new form instance pinned to a specific template version.
     */
    static async createFromTemplate(params: {
        template_id: string;
        organization_id: string;
        user_id: string;
        site_id?: string;
        workpack_id?: string;
        title?: string;
    }) {
        const template = await prisma.formTemplate.findFirst({
            where: { id: params.template_id, organization_id: params.organization_id, is_active: true },
        });

        if (!template) throw new Error('Active form template not found');

        // If site_id or workpack_id not provided, try to inherit from workpack if workpack_id is provided
        let siteId = params.site_id;
        if (!siteId && params.workpack_id) {
            const wp = await prisma.workpack.findUnique({ where: { id: params.workpack_id }, select: { site_id: true } });
            if (wp) siteId = wp.site_id;
        }

        if (!siteId) throw new Error('site_id is required to create a form instance');
        if (!params.workpack_id) throw new Error('workpack_id is required in this schema');

        const instance = await prisma.formInstance.create({
            data: {
                id: uuidv4(),
                organization_id: params.organization_id,
                site_id: siteId,
                workpack_id: params.workpack_id,
                form_template_id: params.template_id,
                template_version: template.current_version,
                title: params.title ?? `${template.name} - ${new Date().toLocaleDateString()}`,
                status: 'draft',
                created_by: params.user_id,
            },
        });

        await AuditService.log({
            organization_id: params.organization_id,
            user_id: params.user_id,
            action: 'created',
            model_name: 'FormInstance',
            model_id: instance.id,
            new_values: instance,
        });

        return instance;
    }

    /**
     * Validate data against a template schema.
     */
    static validateData(schema: any, data: any) {
        const validate = ajv.compile(schema);
        const valid = validate(data);
        return {
            valid,
            errors: validate.errors,
        };
    }

    /**
     * Save a draft. Partial data is allowed.
     */
    static async saveDraft(id: string, organizationId: string, payload: any, userId: string) {
        const instance = await prisma.formInstance.findFirst({
            where: { id, organization_id: organizationId },
        });

        if (!instance) throw new Error('Form instance not found');
        if (instance.status !== 'draft') throw new Error('Can only save drafts for forms in draft status');

        const updated = await prisma.formInstance.update({
            where: { id },
            data: {
                data: payload,
                updated_at: new Date(),
            },
        });

        // Audit but maybe without full values to avoid log bloat for every keystroke?
        // Usually draft saves are frequent.
        await AuditService.log({
            organization_id: organizationId,
            user_id: userId,
            action: 'draft_saved',
            model_name: 'FormInstance',
            model_id: id,
        });

        return updated;
    }

    /**
     * Full submission. Validates against the pinned version of the template.
     */
    static async submit(id: string, organizationId: string, payload: any, userId: string) {
        const instance = await prisma.formInstance.findFirst({
            where: { id, organization_id: organizationId },
            include: { FormTemplate: { include: { Versions: true } } },
        });

        if (!instance) throw new Error('Form instance not found');
        if (instance.status !== 'draft' && instance.status !== 'rejected') {
            throw new Error('Form is already submitted or approved');
        }

        // Find the specific schema version pinned at creation
        const pinnedVersion = instance.FormTemplate.Versions.find(
            (v) => v.version_number === instance.template_version
        );
        const schema = pinnedVersion?.schema_json ?? instance.FormTemplate.schema_json;

        const { valid, errors } = this.validateData(schema, payload);
        if (!valid) {
            throw new Error(`Validation failed: ${ajv.errorsText(errors)}`);
        }

        const updated = await prisma.formInstance.update({
            where: { id },
            data: {
                data: payload,
                status: 'submitted',
                submitted_by: userId,
                submitted_at: new Date(),
            },
        });

        await AuditService.log({
            organization_id: organizationId,
            user_id: userId,
            action: 'submitted',
            model_name: 'FormInstance',
            model_id: id,
            new_values: updated,
        });

        eventBus.emit('form.submitted', {
            form_instance_id: id,
            organization_id: organizationId,
            submitted_by: userId,
        });

        return updated;
    }

    /**
     * Get an instance with validation status.
     */
    static async get(id: string, organizationId: string) {
        const instance = await prisma.formInstance.findFirst({
            where: { id, organization_id: organizationId },
            include: { FormTemplate: { include: { Versions: true } } },
        });

        if (!instance) return null;

        const pinnedVersion = instance.FormTemplate.Versions.find(
            (v) => v.version_number === instance.template_version
        );
        const schema = pinnedVersion?.schema_json ?? instance.FormTemplate.schema_json;

        const validation = this.validateData(schema, instance.data ?? {});

        return {
            ...instance,
            validation,
        };
    }

    /**
     * List instances with filters.
     */
    static async list(filters: {
        organization_id: string;
        workpack_id?: string;
        status?: string;
        page?: number;
        limit?: number;
    }) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const skip = (page - 1) * limit;

        const where = {
            organization_id: filters.organization_id,
            deleted_at: null,
            ...(filters.workpack_id && { workpack_id: filters.workpack_id }),
            ...(filters.status && { status: filters.status as any }),
        };

        const [items, total] = await Promise.all([
            prisma.formInstance.findMany({
                where,
                include: { FormTemplate: { select: { name: true, slug: true } } },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.formInstance.count({ where }),
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
}
