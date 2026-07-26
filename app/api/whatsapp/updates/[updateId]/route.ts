import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  context: { params: Promise<{ updateId: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { updateId } = await context.params;

  const update = await prisma.whatsappUpdate.findFirst({
    where: { id: updateId, organization_id: orgId },
    include: {
      user: { select: { name: true } },
    },
  });

  if (!update) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(update);
}
