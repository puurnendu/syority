import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { AttachmentService } from '@/services/attachments/AttachmentService';

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id: attachmentId } = await params;
        const body = await req.json();
        const { key, parentType, parentId, originalFilename, storedFilename, mimeType, sizeBytes, siteId, category, description } = body;

        if (!key || !parentType || !parentId || !originalFilename || !storedFilename || !mimeType || !sizeBytes) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const attachment = await AttachmentService.confirm({
            organizationId: session.user.organization_id,
            siteId,
            key,
            parent: { type: parentType, id: parentId },
            originalFilename,
            storedFilename,
            mimeType,
            sizeBytes,
            uploadedBy: session.user.id,
            category,
            description,
        });

        // We use the ID from the created attachment if needed, but here we expect the client 
        // to already have some context. The confirm endpoint usually returns the final record.
        return NextResponse.json({
            ...attachment,
            file_size_bytes: Number(attachment.file_size_bytes)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
