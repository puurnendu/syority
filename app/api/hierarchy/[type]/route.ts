import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { assertAllSameOrg } from '@/lib/tenantGuard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { type } = await params;
  const body = await req.json();

  try {
    let result;
    switch (type) {
      case 'site':
        result = await prisma.site.create({ data: { organization_id: orgId, name: body.name, code: body.code } });
        break;
      case 'plant':
        // M8.14-R1: Validate site_id belongs to this organization
        await assertAllSameOrg(prisma, orgId, [['site', body.site_id]]);
        result = await prisma.plant.create({ data: { organization_id: orgId, site_id: body.site_id, name: body.name, code: body.code } });
        break;
      case 'unit':
        // M8.14-R1: Validate site_id + plant_id belong to this organization
        await assertAllSameOrg(prisma, orgId, [['site', body.site_id], ['plant', body.plant_id]]);
        result = await prisma.unit.create({ data: { organization_id: orgId, site_id: body.site_id, plant_id: body.plant_id, name: body.name, code: body.code } });
        break;
      case 'system':
        // M8.14-R1: Validate site_id + unit_id belong to this organization
        await assertAllSameOrg(prisma, orgId, [['site', body.site_id], ['unit', body.unit_id]]);
        result = await prisma.system.create({ data: { organization_id: orgId, site_id: body.site_id, unit_id: body.unit_id, name: body.name, code: body.code } });
        break;
      case 'asset':
        // M8.14-R1: Validate site_id + system_id belong to this organization
        await assertAllSameOrg(prisma, orgId, [['site', body.site_id], ['system', body.system_id]]);
        result = await prisma.asset.create({ 
          data: { 
            organization_id: orgId, 
            site_id: body.site_id, 
            system_id: body.system_id, 
            tag_number: body.tag_number,
            name: body.name,
            asset_type: body.asset_type,
            status: 'draft',
            data_source: 'manual',
            created_by: userId,
          } 
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
