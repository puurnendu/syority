import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const orgId = user.organization_id;

    try {
        const types = await prisma.resourceType.findMany({
            where: { organization_id: orgId },
            include: { Discipline: true },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(types);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = session.user as any;
    const orgId = user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

    try {
        const body = await req.json();
        if (!body?.name?.trim()) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }
        const created = await prisma.resourceType.create({
            data: {
                organization_id: orgId,
                name: String(body.name).trim(),
                code: body.code ? String(body.code).trim() : null,
                discipline_id: body.discipline_id || null,
                is_active: body.is_active !== false,
                created_by: user.id,
                updated_at: new Date(),
            },
        });
        enqueueKnowledgeCapture({
            organizationId: orgId,
            category: 'RESOURCE_TYPE',
            assetType: 'ResourceType',
            title: created.name,
            payload: created as unknown as Record<string, unknown>,
        });
        return NextResponse.json(created, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
