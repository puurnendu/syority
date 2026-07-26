import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';

export async function GET() {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  try {
    const history = await prisma.exportHistory.findMany({
      where: { orgId },
      orderBy: { exportedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(history);
  } catch {
    return NextResponse.json([]);
  }
}
