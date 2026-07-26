import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  const { orgId } = orgScope(session!);
  const { id } = params;

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey || apiKey.organization_id !== orgId) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ApiKeys DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
