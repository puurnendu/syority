import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const rows = await prisma.itemCatalog.groupBy({
    by: ['item_category', 'status'],
    where: {
      organization_id: orgId,
      deleted_at: null,
    },
    _count: { id: true },
  });

  const counts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    counts[row.item_category] = (counts[row.item_category] || 0) + row._count.id;
    statusCounts[row.status] = (statusCounts[row.status] || 0) + row._count.id;
    total += row._count.id;
  }

  return NextResponse.json({ counts, total });
}
