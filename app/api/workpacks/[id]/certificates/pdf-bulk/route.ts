import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/workpacks/[id]/certificates/pdf-bulk
 * Returns a JSON manifest of all include_in_pdf=true certificate instances
 * for a workpack, with template field definitions merged in.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = session.user.organization_id as string;
    const { id: workpackId } = await params;

    const [workpack, certs, jcc] = await Promise.all([
        prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            include: { unit: { select: { name: true, plant: { select: { name: true } } } } },
        }),
        prisma.certificateInstance.findMany({
            where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null, include_in_pdf: true },
            orderBy: { created_at: 'asc' },
        }),
        prisma.jobCompletionCertificate.findUnique({ where: { workpack_id: workpackId } }),
    ]);

    if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

    // Fetch templates separately (no @relation on CertificateInstance)
    const templateIds = [...new Set(certs.map((c) => c.template_id))];
    const templates = templateIds.length > 0
        ? await prisma.certificateTemplate.findMany({
            where: { id: { in: templateIds } },
            select: { id: true, cert_name: true, cert_type: true, fields: true },
        })
        : [];
    const templateMap = Object.fromEntries(templates.map((t) => [t.id, t]));

    const certsWithTemplates = certs.map((c) => ({ ...c, template: templateMap[c.template_id] ?? null }));

    return NextResponse.json({
        workpack,
        jcc,
        certificates: certsWithTemplates,
        total_certs: certs.length,
        generated_at: new Date().toISOString(),
        generated_by: session.user.name ?? session.user.email,
    });
}
