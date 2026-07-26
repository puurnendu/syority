import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';

/**
 * GET: Download a DocumentInstance as JSON.
 * Multi-tenant: workpack and instance must belong to the authenticated organization.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string; instanceId: string }> }
) {
    try {
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id: workpackId, instanceId } = await context.params;

        const workpack = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            select: { id: true },
        });
        if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const instance = await prisma.documentInstance.findFirst({
            where: {
                id: instanceId,
                workpack_id: workpackId,
                organization_id: orgId,
                deleted_at: null,
            },
        });
        if (!instance) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const payload = instance.content_json ?? {};
        const filename = sanitiseFilename(`${(instance.tab_title || instance.document_type || 'document').replace(/\s+/g, '_')}.json`);

        return new NextResponse(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
