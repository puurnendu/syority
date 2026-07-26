import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/** GET /api/plants?siteId=xxx — used by Unit and Equipment forms for dropdowns */
export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('settings.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const siteId = req.nextUrl.searchParams.get('siteId');

  const plants = await prisma.plant.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
      ...(siteId ? { site_id: siteId } : {}),
    },
    orderBy: [{ site_id: 'asc' }, { name: 'asc' }],
    include: {
      site: { select: { id: true, name: true, code: true } },
      _count: { select: { units: true } },
    },
  });

  return NextResponse.json(plants);
}
