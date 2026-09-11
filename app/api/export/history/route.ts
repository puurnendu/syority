import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';

export async function GET() {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  try {
    // OD9.2: `export_history` is snake_case (`org_id`, `exported_at`). The camelCase
    // names here meant every read threw into the catch and returned an empty list.
    const history = await prisma.export_history.findMany({
      where: { org_id: orgId },
      orderBy: { exported_at: 'desc' },
      take: 50,
    });
    return NextResponse.json(history);
  } catch (err) {
    console.error('[Export] Failed to read export_history:', err);
    return NextResponse.json([]);
  }
}
