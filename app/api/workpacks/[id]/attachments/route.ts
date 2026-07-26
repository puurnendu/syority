import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId } = await context.params;

  const attachments = await prisma.workpackAttachment.findMany({
    where: { workpackId },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(attachments);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId } = await context.params;

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.group || !body?.attachmentType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const attachment = await prisma.workpackAttachment.create({
    data: {
      workpackId,
      title: body.title,
      group: body.group,
      subGroup: body.subGroup,
      attachmentType: body.attachmentType,
      templateKey: body.templateKey,
      content: body.content ?? {},
      sortOrder: body.sortOrder ?? 0,
      isActive: true,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
