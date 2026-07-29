import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

/** GET — list attachments for an issue */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  // Verify issue belongs to org
  const issue = await prisma.engineeringIssue.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const attachments = await prisma.issueAttachment.findMany({
    where: { issue_id: id },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({ data: attachments });
}

/** POST — upload attachment */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const issue = await prisma.engineeringIssue.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const attachmentId = randomUUID();
  const storedPath = `attachments/issues/${id}/${attachmentId}_${file.name}`;

  // In production this would upload to cloud storage.
  // For now, store metadata only.
  const attachment = await prisma.issueAttachment.create({
    data: {
      id: attachmentId,
      issue_id: id,
      filename: file.name,
      stored_path: storedPath,
      mime_type: file.type || null,
      file_size_bytes: buffer.length,
      uploaded_by: userId,
    },
  });

  await prisma.issueAuditLog.create({
    data: {
      id: randomUUID(),
      issue_id: id,
      user_id: userId,
      action: 'attach',
      new_value: file.name,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
