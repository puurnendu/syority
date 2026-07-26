import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const site_id = req.nextUrl.searchParams.get('site_id');
  if (!site_id) return NextResponse.json({ error: 'site_id is required' }, { status: 400 });

  const site = await prisma.site.findFirst({
    where: { id: site_id, organization_id: orgId },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const plants = await prisma.plant.findMany({
    where: { site_id, organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      name: true,
      code: true,
      units: {
        where: { deleted_at: null },
        select: {
          id: true,
          name: true,
          code: true,
          systems: {
            where: { deleted_at: null },
            select: {
              id: true,
              name: true,
              code: true,
              assets: {
                where: { deleted_at: null },
                select: { id: true, tag_number: true, name: true, asset_type: true },
              },
            },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  return NextResponse.json({
    plants: plants.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      units: p.units.map((u) => ({
        id: u.id,
        name: u.name,
        code: u.code,
        systems: u.systems.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          assets: s.assets,
        })),
      })),
    })),
  });
}
