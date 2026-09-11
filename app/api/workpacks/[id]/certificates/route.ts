import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CertificateService } from '@/modules/certificates/services/CertificateService';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const type = req.nextUrl.searchParams.get('type') ?? '';
    const orgId = session.user.organization_id as string;

    if (type === 'boxup') return NextResponse.json(await CertificateService.getFlangeBoxupData(workpackId, orgId));
    if (type === 'torque') return NextResponse.json(await CertificateService.getTorqueData(workpackId, orgId));
    if (type === 'hydrotest') return NextResponse.json(await CertificateService.getHydrotestData(workpackId, orgId));

    // Fetch instances then merge template data separately (no @relation in schema)
    const certs = await prisma.certificateInstance.findMany({
        where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
        orderBy: { created_at: 'asc' },
    });

    const templateIds = [...new Set(certs.map((c) => c.template_id))];
    const templates = templateIds.length > 0
        ? await prisma.certificate_templates.findMany({
            where: { id: { in: templateIds } },
            select: { id: true, cert_name: true, cert_type: true, fields: true },
        })
        : [];
    const templateMap = Object.fromEntries(templates.map((t) => [t.id, t]));

    return NextResponse.json(certs.map((c) => ({ ...c, template: templateMap[c.template_id] ?? null })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const { id: workpackId } = await params;
    const body = await req.json().catch(() => null);

    if (body?.template_id) {
        const template = await prisma.certificate_templates.findFirst({
            where: { id: body.template_id, is_active: true },
        });
        if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        const cert = await prisma.certificateInstance.create({
            data: {
                organization_id: orgId,
                workpack_id: workpackId,
                template_id: body.template_id,
                cert_type: template.cert_type,
                cert_name: template.cert_name,
                status: 'not_started',
                field_values: {},
                include_in_pdf: true,
            },
        });
        return NextResponse.json(cert, { status: 201 });
    }

    if (body?.equipment_type) {
        const workpack = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: orgId }, select: { id: true } });
        if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const templates = await prisma.certificate_templates.findMany({
            where: { is_active: true, equipment_types: { has: body.equipment_type } },
        });
        if (templates.length === 0) return NextResponse.json({ attached: 0, message: 'No templates found for this equipment type' });
        const existing = await prisma.certificateInstance.findMany({ where: { workpack_id: workpackId, deleted_at: null }, select: { template_id: true } });
        const existingIds = new Set(existing.map((e) => e.template_id));
        const toCreate = templates.filter((t) => !existingIds.has(t.id));
        const created = await Promise.all(toCreate.map((template) =>
            prisma.certificateInstance.create({
                data: { organization_id: orgId, workpack_id: workpackId, template_id: template.id, cert_type: template.cert_type, cert_name: template.cert_name, status: 'not_started', field_values: {}, include_in_pdf: true },
            })
        ));
        return NextResponse.json({ attached: created.length, certs: created });
    }

    return NextResponse.json({ error: 'template_id or equipment_type required' }, { status: 400 });
}
