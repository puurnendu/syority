/**
 * GET /api/registers/[type] — Equipment Register View
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §18 (R2.1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { type } = await params;
    const { searchParams } = new URL(request.url);

    const plantId = searchParams.get('plant_id') || undefined;
    const unitId = searchParams.get('unit_id') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = {
      organization_id: orgId,
      asset_type: type,
      deleted_at: null,
    };
    if (plantId) where.plant_id = plantId;
    if (unitId) where.unit_id = unitId;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          attribute_values: {
            include: {
              definition: { select: { code: true, name: true, unit: true, group_name: true } },
            },
          },
          nozzles: true,
        },
        take: limit,
        skip: offset,
        orderBy: { tag_number: 'asc' },
      }),
      prisma.asset.count({ where }),
    ]);

    const rows = assets.map((asset: any) => {
      const attrs: Record<string, { value: any; status: string; unit: string | null }> = {};
      for (const val of asset.attribute_values ?? []) {
        attrs[val.definition.code] = {
          value: val.value_number ?? val.value_string ?? val.value_boolean ?? val.value_date,
          status: val.status,
          unit: val.definition.unit,
        };
      }

      return {
        id: asset.id,
        tag_number: asset.tag_number,
        name: asset.name,
        asset_type: asset.asset_type,
        plant_id: asset.plant_id,
        unit_id: asset.unit_id,
        system_id: asset.system_id,
        design_code: asset.design_code,
        corrosion_loop_id: asset.corrosion_loop_id,
        nozzle_count: (asset.nozzles ?? []).length,
        attributes: attrs,
      };
    });

    return NextResponse.json({
      type,
      data: rows,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[GET /api/registers/[type]]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch register view' },
      { status: 500 }
    );
  }
}
