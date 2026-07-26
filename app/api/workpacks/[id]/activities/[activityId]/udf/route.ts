import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * PATCH — save single UDF value for an activity (inline edit).
 * Body: { code: string, value: string | number | null }
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; activityId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: workpackId, activityId } = await context.params;
    const workpack = await prisma.workpack.findFirst({
        where: { id: workpackId, organization_id: orgId, deleted_at: null },
    });
    if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

    const activity = await prisma.activity.findFirst({
        where: { id: activityId, workpack_id: workpackId, deleted_at: null },
    });
    if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

    try {
        const body = await req.json();
        const code = body?.code != null ? String(body.code).trim() : null;
        const value = body?.value;
        if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });

        const definition = await prisma.activityUdfDefinition.findFirst({
            where: { organization_id: orgId, code, deleted_at: null, is_active: true },
            include: { options: { where: { deleted_at: null, is_active: true } } },
        });
        if (!definition) return NextResponse.json({ error: 'UDF definition not found' }, { status: 404 });

        const isNumber = definition.type === 'number';
        const valueText = value == null || value === '' ? null : (isNumber ? null : String(value));
        const valueNum = value == null || value === '' ? null : (isNumber ? Number(value) : null);
        let udfOptionId: string | null = null;
        if (definition.type === 'select' && value != null && value !== '') {
            const strVal = String(value).trim();
            const opt = definition.options.find((o: any) => (o.code_value ?? o.value) === strVal);
            if (opt) udfOptionId = opt.id;
        }

        await prisma.activityUdfValue.upsert({
            where: {
                activity_id_udf_definition_id: { activity_id: activityId, udf_definition_id: definition.id },
            },
            create: {
                organization_id: orgId,
                activity_id: activityId,
                udf_definition_id: definition.id,
                udf_option_id: udfOptionId,
                value_string: valueText,
                value_number: valueNum,
            },
            update: {
                udf_option_id: udfOptionId,
                value_string: valueText,
                value_number: valueNum,
                updated_at: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Save failed' }, { status: 500 });
    }
}
