import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import { uploadFile } from '@/lib/storage/storageClient';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export const POST = withTenantGuard(async (req, { params }, session) => {
  const orgId = session.user.organization_id;
  
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  const { allowed, resetAt } = await checkRateLimit(session.user.id || ip, 'upload');
  if (!allowed) return rateLimitResponse(resetAt);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file?.size) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max 5MB' }, { status: 400 });

    const ext = file.name.split('.').pop() || 'jpg';
    const id = crypto.randomUUID();
    const filename = `${id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { url, key: s3_path } = await uploadFile(
      buffer,
      filename,
      'covers',
      file.type
    );

    await prisma.workpack_print_settings.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, updated_by: session.user.id!, cover_image_path: s3_path },
      update: { cover_image_path: s3_path, updated_by: session.user.id! },
    });
    return NextResponse.json({ s3_path, url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});
