import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * GET: Download a WorkpackDocument file.
 * Multi-tenant: workpack and document must belong to the authenticated organization.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string; docId: string }> }
) {
    try {
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id: workpackId, docId } = await context.params;

        const workpack = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            select: { id: true },
        });
        if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        const doc = await prisma.workpackDocument.findFirst({
            where: {
                id: docId,
                workpack_id: workpackId,
                organization_id: orgId,
                deleted_at: null,
            },
        });
        if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const absolutePath = path.join(process.cwd(), doc.storage_path);
        const buffer = await readFile(absolutePath);
        const mime = doc.mime_type || 'application/octet-stream';
        const filename = sanitiseFilename(doc.original_filename || 'document');

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': mime,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(buffer.length),
            },
        });
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
            return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string; docId: string }> }
) {
    try {
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id, docId } = await context.params;
        let body: Record<string, unknown> | null = null;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const existing = await prisma.workpackDocument.findFirst({
            where: { id: docId, workpack_id: id, organization_id: orgId, deleted_at: null },
        });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const updateData: { include_in_pdf?: boolean; title?: string; description?: string; document_type?: string } = {};
        if (typeof body.include_in_pdf === 'boolean') updateData.include_in_pdf = body.include_in_pdf;
        if (typeof body.title === 'string') updateData.title = body.title;
        if (typeof body.description === 'string') updateData.description = body.description;
        if (typeof body.document_type === 'string') updateData.document_type = body.document_type;
        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        const updated = await prisma.workpackDocument.update({
            where: { id: docId },
            data: updateData,
        });
        // BigInt is not JSON-serializable; send as number for client
        const serialized = {
            ...updated,
            file_size_bytes: updated.file_size_bytes != null ? Number(updated.file_size_bytes) : null,
        };
        return NextResponse.json(serialized);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string; docId: string }> }
) {
    const orgId = await getOrgIdFromRequest(req);
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, docId } = await context.params;
    await prisma.workpackDocument.updateMany({
        where: { id: docId, workpack_id: id, organization_id: orgId },
        data: { deleted_at: new Date() },
    });
    return NextResponse.json({ success: true });
}
