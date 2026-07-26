import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await context.params;
    const definition = await prisma.activityUdfDefinition.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        include: { options: { where: { deleted_at: null }, orderBy: { value: 'asc' } } },
    });

    if (!definition) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(JSON.parse(JSON.stringify(definition)));
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await context.params;
    const existing = await prisma.activityUdfDefinition.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
        const body = await req.json();
        const { name, code, type, is_mandatory, is_active, sort_order } = body;

        const definition = await prisma.activityUdfDefinition.update({
            where: { id },
            data: {
                ...(name != null && { name: String(name) }),
                ...(code != null && { code: String(code) }),
                ...(type != null && { type: String(type) }),
                ...(is_mandatory != null && { is_mandatory: Boolean(is_mandatory) }),
                ...(is_active != null && { is_active: Boolean(is_active) }),
                ...(sort_order != null && { sort_order: Number(sort_order) }),
            },
            include: { options: { where: { deleted_at: null }, orderBy: { value: 'asc' } } },
        });

        return NextResponse.json(JSON.parse(JSON.stringify(definition)));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Update failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as { organization_id?: string };
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    const { id } = await context.params;
    const existing = await prisma.activityUdfDefinition.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.activityUdfDefinition.update({
        where: { id },
        data: { deleted_at: new Date() },
    });

    return NextResponse.json({ ok: true });
}
