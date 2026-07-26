import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const logs = await prisma.itemCatalogImportLog.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  return NextResponse.json(logs);
}
