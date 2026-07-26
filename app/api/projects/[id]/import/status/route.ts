import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { getImportStatus } from '@/lib/importStatus';

export const GET = withTenantGuard(async (req: NextRequest, { params }, hSession) => {
    const { id: projectId } = await params;
    const userId = hSession.user.id;

    const status = await getImportStatus(projectId, userId);
    
    return NextResponse.json({ 
        status: status ?? 'Uploading file...' 
    });
});
