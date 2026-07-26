import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { AttachmentService } from '@/services/attachments/AttachmentService';

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const body = await req.json();
        const { filename, mimeType, sizeBytes, parentType, parentId, siteId } = body;

        if (!filename || !mimeType || !sizeBytes || !parentType || !parentId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await AttachmentService.getUploadUrl({
            organizationId: session.user.organization_id,
            siteId,
            parent: { type: parentType, id: parentId },
            filename,
            mimeType,
            sizeBytes,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
