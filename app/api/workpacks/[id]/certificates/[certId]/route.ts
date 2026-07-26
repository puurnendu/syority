import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function withTemplate(cert: { template_id: string } & Record<string, unknown>) {
    const template = await prisma.certificateTemplate.findFirst({
        where: { id: cert.template_id },
        select: { cert_name: true, cert_type: true, fields: true },
    });
    return { ...cert, template };
}

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string; certId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const { id, certId } = await context.params;

    const cert = await prisma.certificateInstance.findFirst({
        where: { id: certId, workpack_id: id, organization_id: orgId, deleted_at: null },
    });
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(await withTemplate(cert as Record<string, unknown> & { template_id: string }));
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; certId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const { id, certId } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const existing = await prisma.certificateInstance.findFirst({
        where: { id: certId, workpack_id: id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (body.field_values) updateData.field_values = { ...(existing.field_values as object ?? {}), ...body.field_values };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.include_in_pdf !== undefined) updateData.include_in_pdf = body.include_in_pdf;
    if (body.pass_fail !== undefined) updateData.pass_fail = body.pass_fail;
    if (body.remarks !== undefined) updateData.remarks = body.remarks;
    if (body.prepared_by !== undefined) updateData.prepared_by = body.prepared_by;
    if (body.prepared_date !== undefined) updateData.prepared_date = body.prepared_date ? new Date(body.prepared_date) : null;
    if (body.reviewed_by !== undefined) updateData.reviewed_by = body.reviewed_by;
    if (body.reviewed_date !== undefined) updateData.reviewed_date = body.reviewed_date ? new Date(body.reviewed_date) : null;
    if (body.approved_by !== undefined) updateData.approved_by = body.approved_by;
    if (body.approved_date !== undefined) updateData.approved_date = body.approved_date ? new Date(body.approved_date) : null;
    if (body.third_party_inspector !== undefined) updateData.third_party_inspector = body.third_party_inspector;
    if (body.third_party_date !== undefined) updateData.third_party_date = body.third_party_date ? new Date(body.third_party_date) : null;

    const updated = await prisma.certificateInstance.update({ where: { id: certId }, data: updateData });

    if (body.status === 'pending_sign' && existing.status !== 'pending_sign') {
        const { notifyOrgAdmins } = await import('@/lib/notifications/createNotification');
        void notifyOrgAdmins(orgId, {
            type: 'cert_pending',
            title: '📜 Certificate ready for sign-off',
            body: `${updated.cert_name} requires sign-off`,
            link: `/workpacks/${id}#certificates`,
            entityType: 'certificate',
            entityId: certId,
        });
    }

    return NextResponse.json(await withTemplate(updated as Record<string, unknown> & { template_id: string }));
}

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string; certId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const { id, certId } = await context.params;
    await prisma.certificateInstance.updateMany({
        where: { id: certId, workpack_id: id, organization_id: orgId },
        data: { deleted_at: new Date() },
    });
    return NextResponse.json({ success: true });
}
