import { prisma } from '@/lib/prisma';

/** UDF value payload: keyed by UDF code; value is string, number, or null. */
export type UdfDataPayload = Record<string, string | number | null>;

export interface MandatoryValidationResult {
    valid: boolean;
    missing?: string[];
}

/**
 * Activity UDF service — organization-scoped.
 * Enforces organization_id on all operations.
 */
export class ActivityUdfService {
    /**
     * Get active UDF definitions for an organization, with options for select/dropdown types.
     * Ordered by sort_order then name.
     */
    static async getDefinitions(orgId: string) {
        return prisma.activityUdfDefinition.findMany({
            where: {
                organization_id: orgId,
                is_active: true,
                deleted_at: null,
            },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: {
                options: {
                    where: { is_active: true, deleted_at: null },
                    orderBy: { value: 'asc' },
                },
            },
        });
    }

    /**
     * Save UDF values for an activity. Activity must belong to the same organization as the UDF definitions.
     * udfData is keyed by UDF code; values are string, number, or null (null clears).
     */
    static async saveUdfValues(
        activityId: string,
        organizationId: string,
        udfData: UdfDataPayload
    ): Promise<void> {
        const activity = await prisma.activity.findFirst({
            where: { id: activityId, organization_id: organizationId, deleted_at: null },
        });
        if (!activity) throw new Error('Activity not found');

        const definitions = await prisma.activityUdfDefinition.findMany({
            where: { organization_id: organizationId, deleted_at: null },
            include: { options: { where: { deleted_at: null } } },
        });
        const defByCode = new Map(definitions.map((d) => [d.code, d]));

        for (const [code, value] of Object.entries(udfData)) {
            const def = defByCode.get(code);
            if (!def) continue;

            const isSelect = def.type === 'select';
            const isNumber = def.type === 'number';
            const isText = def.type === 'text' || !isSelect && !isNumber;

            let udf_option_id: string | null = null;
            let value_string: string | null = null;
            let value_number: number | null = null;

            if (value === null || value === undefined || value === '') {
                value_string = null;
                value_number = null;
                udf_option_id = null;
            } else if (isSelect && typeof value === 'string') {
                const option = def.options.find(
                    (o) => o.code_value === value || o.value === value
                );
                udf_option_id = option?.id ?? null;
                value_string = option ? null : value;
            } else if (isNumber && typeof value === 'number') {
                value_number = value;
            } else if (typeof value === 'number') {
                value_number = value;
            } else {
                value_string = String(value);
            }

            await prisma.activityUdfValue.upsert({
                where: {
                    activity_id_udf_definition_id: {
                        activity_id: activityId,
                        udf_definition_id: def.id,
                    },
                },
                create: {
                    organization_id: organizationId,
                    activity_id: activityId,
                    udf_definition_id: def.id,
                    udf_option_id: udf_option_id ?? undefined,
                    value_string: value_string ?? undefined,
                    value_number: value_number ?? undefined,
                },
                update: {
                    udf_option_id: udf_option_id ?? undefined,
                    value_string: value_string ?? undefined,
                    value_number: value_number ?? undefined,
                },
            });
        }
    }

    /**
     * Validate that an activity has values for all mandatory UDFs in its organization.
     * Returns { valid, missing } where missing is the list of UDF codes that are mandatory but empty.
     */
    static async validateMandatoryUdfs(activityId: string): Promise<MandatoryValidationResult> {
        const activity = await prisma.activity.findFirst({
            where: { id: activityId, deleted_at: null },
        });
        if (!activity) throw new Error('Activity not found');

        const mandatoryDefs = await prisma.activityUdfDefinition.findMany({
            where: {
                organization_id: activity.organization_id,
                is_mandatory: true,
                is_active: true,
                deleted_at: null,
            },
        });
        if (mandatoryDefs.length === 0) return { valid: true };

        const values = await prisma.activityUdfValue.findMany({
            where: {
                activity_id: activityId,
                udf_definition_id: { in: mandatoryDefs.map((d) => d.id) },
            },
        });
        const valueByDefId = new Map(values.map((v) => [v.udf_definition_id, v]));

        const missing: string[] = [];
        for (const def of mandatoryDefs) {
            const v = valueByDefId.get(def.id);
            const hasValue =
                v &&
                (v.value_string != null && v.value_string !== '' ||
                    v.value_number != null ||
                    v.udf_option_id != null);
            if (!hasValue) missing.push(def.code);
        }

        return {
            valid: missing.length === 0,
            ...(missing.length > 0 && { missing }),
        };
    }
}
