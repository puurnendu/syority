import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { DigitalPlantService } from '@/core/digital-plant';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const result = await DigitalPlantService.listProjects({
    organizationId: orgId,
    siteId: searchParams.get('site_id') ?? undefined,
    status: (searchParams.get('status') as any) ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '25', 10),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  const { site_id, plant_id, area_id, unit_id, system_id, name, description } = body;

  if (!site_id || !plant_id || !unit_id || !name) {
    return NextResponse.json({ error: 'site_id, plant_id, unit_id, and name are required' }, { status: 400 });
  }

  const project = await DigitalPlantService.createProject({
    organizationId: orgId,
    siteId: site_id,
    plantId: plant_id,
    areaId: area_id,
    unitId: unit_id,
    systemId: system_id,
    name,
    description,
    createdBy: userId,
  });

  return NextResponse.json(project, { status: 201 });
}
