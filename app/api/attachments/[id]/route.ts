import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { AttachmentService } from '@/services/attachments/AttachmentService';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        const result = await AttachmentService.getDownloadUrl(
            id,
            session.user.organization_id,
            session.user.id
        );
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }
});

export const DELETE = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        await AttachmentService.delete(
            id,
            session.user.organization_id,
            session.user.id
        );
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }
});
