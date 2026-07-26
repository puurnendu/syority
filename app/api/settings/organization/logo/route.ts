import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { guardApi } from '@/lib/apiGuard';
import { OrgService } from '@/core/tenant/services/OrgService';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Handle organization logo upload.
 * Endpoint: POST /api/settings/organization/logo
 */
export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
    // 1. Check for 'settings.org.edit' permission
    const { error } = await guardApi('settings.org.edit');
    if (error) return error;

    const orgId = session.user.organization_id;
    const userId = session.user.id;

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 2. Validate file type (image only)
        const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'File type not supported. Use PNG, JPG, SVG or WEBP.' }, { status: 400 });
        }

        // 3. Validate file size (Max 2MB as per frontend guidance)
        const MAX_SIZE = 2 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum 2MB.' }, { status: 400 });
        }

        // 4. Prepare storage directory
        const publicDir = path.join(process.cwd(), 'public', 'logos', orgId);
        if (!existsSync(publicDir)) {
            await mkdir(publicDir, { recursive: true });
        }

        // 5. Generate filename and save file
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const filename = `${Date.now()}.${ext}`;
        const filePath = path.join(publicDir, filename);
        const publicUrl = `/logos/${orgId}/${filename}`;

        await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

        // 6. Update organization logoUrl in DB
        // Use OrgService.update to leverage its audit logging logic
        await OrgService.update(orgId, { logoUrl: publicUrl }, userId);

        return NextResponse.json({ url: publicUrl }, { status: 201 });

    } catch (err: any) {
        console.error('[LogoUpload] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error during upload' }, { status: 500 });
    }
});
