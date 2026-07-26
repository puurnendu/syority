import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CODE_REGEX = /^[a-z][a-z0-9_]*$/;

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const def = await prisma.activityUdfDefinition.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        include: { options: { where: { deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { value: 'asc' }] } },
    });
    if (!def) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(def);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const existing = await prisma.activityUdfDefinition.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
        const body = await req.json();
        if (body.type !== undefined && body.type !== existing.type) return NextResponse.json({ error: 'data_type cannot be changed after creation' }, { status: 400 });
        if (body.data_type !== undefined && body.data_type !== existing.type) return NextResponse.json({ error: 'data_type cannot be changed after creation' }, { status: 400 });
        const newCode = body.code != null ? String(body.code).trim().toLowerCase().replace(/\s+/g, '_') : null;
        if (newCode != null && newCode !== existing.code) {
            if (!CODE_REGEX.test(newCode)) return NextResponse.json({ error: 'code must match /^[a-z][a-z0-9_]*$/' }, { status: 400 });
            const usageCount = await prisma.activityUdfValue.count({ where: { udf_definition_id: id } });
            if (usageCount > 0) return NextResponse.json({ error: 'CODE_LOCKED', message: 'Cannot change code - activities have values' }, { status: 409 });
        }
        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = String(body.name).trim();
        if (newCode != null) data.code = newCode;
        if (body.is_mandatory !== undefined) data.is_mandatory = Boolean(body.is_mandatory);
        if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order);
        if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);
        const updated = await prisma.activityUdfDefinition.update({
            where: { id },
            data: data as any,
            include: { options: { where: { deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { value: 'asc' }] } },
        });
        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const existing = await prisma.activityUdfDefinition.findFirst({ where: { id, organization_id: orgId, deleted_at: null } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const usageCount = await prisma.activityUdfValue.count({ where: { udf_definition_id: id } });
    if (usageCount > 0) return NextResponse.json({ error: 'UDF in use', message: 'Deactivate instead of delete' }, { status: 409 });
    await prisma.activityUdfDefinition.update({ where: { id }, data: { deleted_at: new Date() } });
    return NextResponse.json({ success: true });
}
