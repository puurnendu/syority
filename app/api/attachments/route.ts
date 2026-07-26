import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { AttachmentService } from '@/services/attachments/AttachmentService';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { searchParams } = new URL(req.url);
        const parentType = searchParams.get('parentType');
        const parentId = searchParams.get('parentId');

        if (!parentType || !parentId) {
            return NextResponse.json({ error: 'Missing parentType or parentId' }, { status: 400 });
        }

        const attachments = await AttachmentService.listByParent(
            { type: parentType, id: parentId },
            session.user.organization_id
        );

        const serialized = attachments.map(a => ({
            ...a,
            file_size_bytes: Number(a.file_size_bytes)
        }));

        return NextResponse.json(serialized);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
