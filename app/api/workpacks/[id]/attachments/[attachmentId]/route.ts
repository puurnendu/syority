import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId, attachmentId } = await context.params;

  const body = await req.json().catch(() => null);
  
  const attachment = await prisma.workpackAttachment.update({
    where: { id: attachmentId, workpackId },
    data: {
      title: body.title,
      content: body.content,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    },
  });

  return NextResponse.json(attachment);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: workpackId, attachmentId } = await context.params;

  await prisma.workpackAttachment.delete({
    where: { id: attachmentId, workpackId },
  });

  return new NextResponse(null, { status: 204 });
}
