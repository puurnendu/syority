import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';

export async function GET(req: NextRequest) {
    const { session, error } = await guardApi('settings.udf.view');
    if (error) return error;
    const user = session!.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const definitions = await prisma.activityUdfDefinition.findMany({
        where: { organization_id: orgId, deleted_at: null },
        include: { options: { where: { deleted_at: null }, orderBy: { value: 'asc' } } },
        orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
    });

    return NextResponse.json(JSON.parse(JSON.stringify(definitions)));
}

export async function POST(req: NextRequest) {
    const { session, error } = await guardApi('settings.udf.edit');
    if (error) return error;
    const user = session!.user as { id: string; organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    try {
        const body = await req.json();
        const { name, code, type, is_mandatory, is_active, sort_order } = body;
        if (!name || !code || !type) {
            return NextResponse.json({ error: 'Name, code and type are required' }, { status: 400 });
        }

        const definition = await prisma.activityUdfDefinition.create({
            data: {
                organization_id: orgId,
                name: String(name),
                code: String(code),
                type: String(type),
                is_mandatory: Boolean(is_mandatory),
                is_active: is_active !== false,
                sort_order: sort_order != null ? Number(sort_order) : null,
                created_by: user.id,
            },
            include: { options: true },
        });

        enqueueKnowledgeCapture({
            organizationId: orgId,
            category: 'UDF_DEFINITION',
            assetType: 'ActivityUdfDefinition',
            title: definition.name,
            payload: definition as unknown as Record<string, unknown>,
        });

        return NextResponse.json(JSON.parse(JSON.stringify(definition)), { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Create failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
