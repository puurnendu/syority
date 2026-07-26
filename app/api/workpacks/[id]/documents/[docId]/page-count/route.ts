import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { getPdfPageCount } from '@/services/ai/PdfProcessor';
import { join } from 'path';

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string; docId: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id, docId } = await context.params;

    const doc = await prisma.workpackDocument.findFirst({
        where: {
            id: docId,
            workpack_id: id,
            organization_id: orgId,
            deleted_at: null,
        },
        select: { storage_path: true },
    });
    if (!doc)
        return NextResponse.json(
            { error: 'Not found' },
            { status: 404 }
        );

    const fullPath = doc.storage_path.startsWith('/')
        ? doc.storage_path
        : join(process.cwd(), doc.storage_path);

    const count = await getPdfPageCount(fullPath);
    return NextResponse.json({ page_count: count });
}
