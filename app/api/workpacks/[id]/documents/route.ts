import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import { uploadFile } from '@/lib/storage/storageClient';
import { AttachmentService } from '@/services/attachments/AttachmentService';
import crypto from 'crypto';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        const orgId = session.user.organization_id;
        await assertTenantAccess('workpack', id, orgId);

        const docs = await prisma.workpackDocument.findMany({
            where: { workpack_id: id, organization_id: orgId, deleted_at: null },
            orderBy: [{ source: 'asc' }, { created_at: 'desc' }],
        });

        const serialized = docs.map((d) => ({
            ...d,
            file_size_bytes: d.file_size_bytes != null ? Number(d.file_size_bytes) : null,
        }));
        return NextResponse.json(serialized);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        const orgId = session.user.organization_id;
        
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
        const { allowed, resetAt } = await checkRateLimit(session.user.id || ip, 'upload');
        if (!allowed) return rateLimitResponse(resetAt);

        await assertTenantAccess('workpack', id, orgId);

        const workpack = await prisma.workpack.findFirst({
            where: { id, organization_id: orgId, deleted_at: null },
            select: { id: true, site_id: true },
        });
        if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const formData = await req.formData().catch(() => null);
        if (!formData) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
        
        const file = formData.get('file') as File | null;
        const title = (formData.get('title') as string) ?? '';
        const document_type = (formData.get('document_type') as string) ?? 'attachment';
        const description = (formData.get('description') as string) ?? '';

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        // CONSUME ATTACHMENT SERVICE: Centralized Validation
        await AttachmentService.validateUpload(orgId, file.type, file.size);

        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const storedFilename = `${crypto.randomUUID()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { key: storage_path } = await uploadFile(
            buffer,
            storedFilename,
            `workpacks/${id}`,
            file.type
        );

        const doc = await prisma.workpackDocument.create({
            data: {
                organization_id: orgId,
                site_id: workpack.site_id!,
                workpack_id: id,
                original_filename: file.name,
                storage_path,
                mime_type: file.type,
                file_size_bytes: BigInt(file.size),
                document_type,
                title: title || file.name,
                description,
                include_in_pdf: false,
                source: 'manual',
                updated_at: new Date(),
            },
        });

        const serialized = { ...doc, file_size_bytes: Number(doc.file_size_bytes) };
        return NextResponse.json(serialized, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
