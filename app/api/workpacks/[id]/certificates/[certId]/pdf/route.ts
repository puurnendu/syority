import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/workpacks/[id]/certificates/[certId]/pdf
 * Returns structured data for rendering a single certificate as a PDF.
 * No @relation exists between CertificateInstance and CertificateTemplate —
 * templates are fetched separately.
 */
export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string; certId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const { id: workpackId, certId } = await context.params;

    const cert = await prisma.certificateInstance.findFirst({
        where: { id: certId, workpack_id: workpackId, organization_id: orgId, deleted_at: null },
    });
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [template, workpack] = await Promise.all([
        prisma.certificate_templates.findFirst({
            where: { id: cert.template_id },
            select: { cert_name: true, cert_type: true, fields: true },
        }),
        prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            include: { unit: { select: { name: true, plant: { select: { name: true } } } } },
        }),
    ]);

    return NextResponse.json({
        cert: { ...cert, template },
        workpack,
        generated_at: new Date().toISOString(),
        generated_by: session.user.name ?? session.user.email,
    });
}
