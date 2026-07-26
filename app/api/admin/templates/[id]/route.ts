import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WorkpackTemplateService } from '@/core/master-data/services/WorkpackTemplateService';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    const { id } = await params;
    const template = await WorkpackTemplateService.getTemplate(id, orgId);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    const { id } = await params;
    const data = await req.json();
    const updated = await WorkpackTemplateService.updateTemplate(id, orgId, data, session.user.id);
    return NextResponse.json(updated);
}

// ── Activities within Template ──────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id;
    const { id: templateId } = await params;

    const data = await req.json();
    const lastSeq = await prisma.workpackTemplateActivity.aggregate({
        where: { template_id: templateId },
        _max: { sequence_number: true }
    });
    const seq = (lastSeq._max.sequence_number || 0) + 1;

    const activity = await prisma.workpackTemplateActivity.create({
        data: {
            ...data,
            template_id: templateId,
            sequence_number: seq,
        }
    });

    return NextResponse.json(activity);
}
