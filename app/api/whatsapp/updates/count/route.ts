import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const pending = await prisma.whatsappUpdate.count({
    where: { organization_id: orgId, status: 'parked_review' },
  });

  return NextResponse.json({ pending });
}
