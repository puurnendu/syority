import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const def = await prisma.activityUdfDefinition.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!def) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const options = await prisma.activityUdfOption.findMany({
        where: { udf_definition_id: id, deleted_at: null },
        orderBy: [{ sort_order: 'asc' }, { value: 'asc' }],
    });
    return NextResponse.json(options);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const def = await prisma.activityUdfDefinition.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!def) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
        const body = await req.json();
        const options: Array<{ id?: string; code_value?: string; value?: string; label?: string; description?: string; sort_order?: number; is_active?: boolean }> = Array.isArray(body.options) ? body.options : [];
        const submittedIds = new Set<string>();
        for (const o of options) {
            const cv = (o.code_value ?? o.value ?? '').toString().trim().toUpperCase().replace(/\s+/g, '_');
            if (!cv) continue;
            if (o.id) submittedIds.add(o.id);
        }
        const existingOptions = await prisma.activityUdfOption.findMany({ where: { udf_definition_id: id, deleted_at: null } });
        for (const ex of existingOptions) {
            if (submittedIds.has(ex.id)) continue;
            const count = await prisma.activityUdfValue.count({ where: { udf_option_id: ex.id } });
            if (count > 0) return NextResponse.json({ error: 'OPTION_IN_USE', option: ex.code_value ?? ex.value, usage_count: count, message: `Option in use by ${count} activities — deactivate instead` }, { status: 409 });
        }
        await prisma.$transaction(async (tx) => {
            let so = 0;
            for (const o of options) {
                const cv = (o.code_value ?? o.value ?? '').toString().trim().toUpperCase().replace(/\s+/g, '_');
                const label = (o.label ?? o.description ?? cv).toString().trim() || cv;
                const desc = (o.description ?? '').toString().trim() || null;
                if (o.id && existingOptions.some((e) => e.id === o.id)) {
                    await tx.activityUdfOption.update({
                        where: { id: o.id },
                        data: { code_value: cv, value: cv, label, description: desc, sort_order: o.sort_order ?? so, is_active: o.is_active !== false, updated_at: new Date() },
                    });
                } else {
                    await tx.activityUdfOption.create({
                        data: { organization_id: orgId, udf_definition_id: id, value: cv, label, code_value: cv, description: desc, sort_order: o.sort_order ?? so, is_active: o.is_active !== false },
                    });
                }
                so++;
            }
            for (const ex of existingOptions) {
                if (submittedIds.has(ex.id)) continue;
                const inUse = await tx.activityUdfValue.count({ where: { udf_option_id: ex.id } });
                if (inUse === 0) await tx.activityUdfOption.update({ where: { id: ex.id }, data: { deleted_at: new Date() } });
            }
        });
        const updated = await prisma.activityUdfOption.findMany({
            where: { udf_definition_id: id, deleted_at: null },
            orderBy: [{ sort_order: 'asc' }, { value: 'asc' }],
        });
        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Update failed' }, { status: 500 });
    }
}
