import path from 'path';
import { mkdir } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import { guardApi } from '@/lib/apiGuard';
import { uploadFile } from '@/lib/storage/storageClient';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

export const POST = withTenantGuard(async (req, { params }, session) => {
  const orgId = session.user.organization_id;
  
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  const { allowed, resetAt } = await checkRateLimit(session.user.id || ip, 'upload');
  if (!allowed) return rateLimitResponse(resetAt);
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || 'Logo';
    if (!file?.size) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max 5MB' }, { status: 400 });

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg');
    const safeExt = ext === 'svg' ? 'svg' : ext === 'jpg' ? 'jpg' : ext === 'webp' ? 'webp' : 'png';

    const cwd = process.cwd();
    const logosDir = path.join(cwd, 'public', 'logos');
    await mkdir(logosDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicLogoFilename = `org-${orgId}-logo.${safeExt}`;
    
    // Use storageClient instead of manual fs
    const { url, key: s3_path } = await uploadFile(
      buffer,
      publicLogoFilename,
      'logos',
      file.type
    );

    await prisma.organization.update({
      where: { id: orgId },
      data: { logo_path: url },
    });

    const id = crypto.randomUUID();
    const settings = await prisma.workpack_print_settings.findUnique({ where: { organization_id: orgId } });
    const library = (settings?.logo_library as { id: string; name: string; s3_path: string; url: string }[]) ?? [];
    const newItem = { id, name, s3_path, url };
    await prisma.workpack_print_settings.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, updated_by: session.user.id!, logo_library: [...library, newItem] },
      update: { logo_library: [...library, newItem], updated_by: session.user.id! },
    });

    return NextResponse.json({ id, name, s3_path, url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});
