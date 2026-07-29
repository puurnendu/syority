import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/hierarchy?site_id=<uuid>
 * Returns the full nested hierarchy tree for a site:
 * Plant → Area? → Unit → System → Asset
 *
 * Backward-compatible: response shape adds `areas` under each plant.
 * Units are nested under their Area if they have one, or directly under Plant if not.
 */
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

  // Fetch plants with areas and units
  const plants = await prisma.plant.findMany({
    where: { site_id, organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      name: true,
      code: true,
      areas: {
        where: { deleted_at: null },
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: { name: 'asc' },
      },
      units: {
        where: { deleted_at: null },
        select: {
          id: true,
          name: true,
          code: true,
          area_id: true,
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
    plants: plants.map((p) => {
      // Group units by area for the nested response
      const areaMap = new Map<string, typeof p.units>();
      const topLevelUnits: typeof p.units = [];

      for (const u of p.units) {
        if (u.area_id) {
          const list = areaMap.get(u.area_id) ?? [];
          list.push(u);
          areaMap.set(u.area_id, list);
        } else {
          topLevelUnits.push(u);
        }
      }

      const mapUnit = (u: (typeof p.units)[0]) => ({
        id: u.id,
        name: u.name,
        code: u.code,
        systems: u.systems.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          assets: s.assets,
        })),
      });

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        areas: p.areas.map((a) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          units: (areaMap.get(a.id) ?? []).map(mapUnit),
        })),
        // Top-level units (no area) — backward compat
        units: topLevelUnits.map(mapUnit),
      };
    }),
  });
}
