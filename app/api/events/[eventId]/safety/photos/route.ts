import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

async function ensureEventAccess(eventId: string, orgId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  return event;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, error } = await guardApi('safety.log');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const user = session!.user as { id?: string; name?: string; email?: string };

  const { eventId } = await params;
  const event = await ensureEventAccess(eventId, orgId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const photoType = (formData.get('photo_type') as string) ?? 'general';
  const caption = (formData.get('caption') as string) ?? '';
  const logId = (formData.get('log_id') as string) ?? '';
  const incidentId = (formData.get('incident_id') as string) ?? '';

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WEBP or PDF.' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  const dir = path.join(process.cwd(), 'public', 'safety', eventId, today);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${photoType}_${Date.now()}.${ext}`;
  const filePath = path.join(dir, filename);
  const publicUrl = `/safety/${eventId}/${today}/${filename}`;

  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const photo = await prisma.safetyPhoto.create({
    data: {
      eventId,
      safetyLogId: logId || null,
      incidentId: incidentId || null,
      photoType,
      caption: caption || null,
      storagePath: filePath,
      publicUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.id ?? null,
      uploadedByName: user.name ?? user.email ?? null,
    },
  });

  return NextResponse.json({ photo });
}
