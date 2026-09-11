import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ templateId: string }> }
) {
    const { session, error } = await guardApi('settings.templates.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { templateId } = await params;

    const existing = await prisma.certificate_templates.findFirst({
        where: { id: templateId },
        select: { is_platform: true, organization_id: true },
    });
    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.is_platform) {
        return NextResponse.json(
            { error: 'Platform templates cannot be edited' },
            { status: 403 }
        );
    }
    if (existing.organization_id !== orgId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.cert_name != null) data.cert_name = body.cert_name.trim();
    if (body.equipment_types != null) data.equipment_types = body.equipment_types;
    if (body.fields != null) data.fields = body.fields;
    if (body.is_active != null) data.is_active = body.is_active;

    const updated = await prisma.certificate_templates.update({
        where: { id: templateId },
        data: data,
    });
    enqueueKnowledgeCapture({
        organizationId: orgId,
        category: 'CERTIFICATE_TEMPLATE',
        assetType: 'certificate_templates',
        title: updated.cert_name,
        payload: updated as unknown as Record<string, unknown>,
    });
    return NextResponse.json(updated);
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ templateId: string }> }
) {
    const { session, error } = await guardApi('settings.templates.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { templateId } = await params;

    const existing = await prisma.certificate_templates.findFirst({
        where: { id: templateId },
        select: { is_platform: true, organization_id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.is_platform) return NextResponse.json({ error: 'Platform templates cannot be deleted' }, { status: 403 });
    if (existing.organization_id !== orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.certificate_templates.delete({ where: { id: templateId } });
    return NextResponse.json({ success: true });
}
