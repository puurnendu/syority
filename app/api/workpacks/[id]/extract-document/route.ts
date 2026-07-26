import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { runDocumentExtraction } from '@/services/ai/DocumentParameterExtractor';
import { join } from 'path';

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (
        !body?.source_document_id ||
        !body?.page_ranges?.length ||
        !body?.parameters?.length
    ) {
        return NextResponse.json(
            {
                error:
                    'source_document_id, page_ranges, and parameters are required',
            },
            { status: 400 }
        );
    }

    const doc = await prisma.workpackDocument.findFirst({
        where: {
            id: body.source_document_id,
            workpack_id: id,
            organization_id: orgId,
            deleted_at: null,
        },
        select: {
            id: true,
            storage_path: true,
            mime_type: true,
        },
    });
    if (!doc)
        return NextResponse.json(
            { error: 'Document not found' },
            { status: 404 }
        );
    if (
        doc.mime_type !== 'application/pdf' &&
        !doc.storage_path.endsWith('.pdf')
    ) {
        return NextResponse.json(
            { error: 'Document must be a PDF' },
            { status: 400 }
        );
    }

    const storagePath = doc.storage_path.startsWith('/')
        ? doc.storage_path
        : join(process.cwd(), doc.storage_path);

    const result = await runDocumentExtraction({
        workpack_id: id,
        organization_id: orgId,
        source_document_id: doc.id,
        source_storage_path: storagePath,
        page_ranges: body.page_ranges,
        parameters: body.parameters,
        custom_instruction: body.custom_instruction ?? null,
        requested_by: session!.user.id,
    });

    return NextResponse.json(result, { status: 201 });
}
