import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/** M8.14-R1 — Controlled criticality values (matches AssetCriticality enum) */
const VALID_CRITICALITY = ['low', 'medium', 'high', 'critical'] as const;
/** M8.14-R1 — Controlled status values (matches AssetStatus enum) */
const VALID_STATUS = ['draft', 'active', 'retired'] as const;

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const site_id = searchParams.get('site_id') ?? undefined;
  const unit_id = searchParams.get('unit_id') ?? undefined;
  const system_id = searchParams.get('system_id') ?? undefined;
  const plant_id = searchParams.get('plant_id') ?? undefined;
  const asset_type = searchParams.get('asset_type') ?? undefined;
  const criticality = searchParams.get('criticality') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const include_nozzles = searchParams.get('include_nozzles') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    organization_id: orgId,
    deleted_at: null,
  };
  if (site_id) (where as any).site_id = site_id;
  if (system_id) (where as any).system_id = system_id;
  if (asset_type) (where as any).asset_type = asset_type;
  if (criticality) (where as any).criticality = criticality;
  if (search) {
    (where as any).OR = [
      { tag_number: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (unit_id || plant_id) {
    (where as any).system =
      unit_id && plant_id
        ? { unit_id, unit: { plant_id } }
        : unit_id
          ? { unit_id }
          : { unit: { plant_id } };
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        Site: { select: { id: true, name: true, code: true } },
        system: { 
          select: { 
            id: true, 
            name: true, 
            code: true,
            unit: { 
              select: { 
                id: true, 
                name: true, 
                code: true,
                plant: { select: { id: true, name: true, code: true } }
              } 
            } 
          } 
        },
        ...(include_nozzles ? { nozzles: { where: { deleted_at: null } } } : {}),
      },
      orderBy: [{ tag_number: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.asset.count({ where }),
  ]);

  const hierarchyPath = (a: (typeof assets)[0]) => {
    const u = a.system?.unit;
    const p = u?.plant;
    return p ? `${p.name} › ${u?.name} › ${a.system?.name ?? '—'} › ${a.tag_number}` : a.system ? `${a.system.unit?.name} › ${a.system.name} › ${a.tag_number}` : `${a.tag_number}`;
  };

  return NextResponse.json({
    data: assets.map((a) => ({
      ...a,
      hierarchy_path: hierarchyPath(a),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json().catch(() => null);
  if (!body?.site_id) return NextResponse.json({ error: 'site_id is required' }, { status: 400 });
  if (!body?.tag_number?.trim()) return NextResponse.json({ error: 'tag_number is required' }, { status: 400 });
  if (!body?.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // M8.14-R1: Validate criticality against controlled enum
  if (body.criticality && !VALID_CRITICALITY.includes(body.criticality)) {
    return NextResponse.json({ error: `criticality must be one of: ${VALID_CRITICALITY.join(', ')}` }, { status: 400 });
  }

  const tag = String(body.tag_number).trim().toUpperCase();
  const site = await prisma.site.findFirst({
    where: { id: body.site_id, organization_id: orgId },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const existing = await prisma.asset.findUnique({
    where: { organization_id_tag_number: { organization_id: orgId, tag_number: tag } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: `Asset with tag_number "${tag}" already exists` }, { status: 409 });

  if (body.system_id) {
    const sys = await prisma.system.findFirst({
      where: { id: body.system_id, organization_id: orgId },
      select: { id: true, site_id: true },
    });
    if (!sys || sys.site_id !== body.site_id) return NextResponse.json({ error: 'System not found or does not belong to site' }, { status: 400 });
  }

  const asset = await prisma.asset.create({
    data: {
      organization_id: orgId,
      site_id: body.site_id,
      system_id: body.system_id ?? null,
      tag_number: tag,
      name: String(body.name).trim(),
      asset_type: body.asset_type?.trim() ?? null,
      sap_equipment_number: body.sap_equipment_number?.trim() ?? null,
      description: body.description?.trim() ?? null,
      manufacturer: body.manufacturer?.trim() ?? null,
      model_number: body.model_number?.trim() ?? null,
      serial_number: body.serial_number?.trim() ?? null,
      year_installed: body.year_installed ?? null,
      design_pressure_barg: body.design_pressure_barg ?? null,
      design_temp_c: body.design_temp_c ?? null,
      operating_pressure_barg: body.operating_pressure_barg ?? null,
      operating_temp_c: body.operating_temp_c ?? null,
      test_pressure_barg: body.test_pressure_barg ?? null,
      weight_empty_kg: body.weight_empty_kg ?? null,
      weight_operating_kg: body.weight_operating_kg ?? null,
      service_description: body.service_description?.trim() ?? null,
      fluid_service: body.fluid_service?.trim() ?? null,
      criticality: body.criticality ?? null,
      maintenance_strategy: body.maintenance_strategy?.trim() ?? null,
      inspection_interval_months: body.inspection_interval_months ?? null,
      p_and_id_numbers: Array.isArray(body.p_and_id_numbers) ? body.p_and_id_numbers : (body.p_and_id_numbers ? [body.p_and_id_numbers] : []),
      ga_drawing_number: body.ga_drawing_number?.trim() ?? null,
      isometric_drawing_numbers: Array.isArray(body.isometric_drawing_numbers) ? body.isometric_drawing_numbers : [],
      plot_area: body.plot_area?.trim() ?? null,
      elevation: body.elevation?.trim() ?? null,
      train: body.train?.trim() ?? null,
      sap_functional_location: body.sap_functional_location?.trim() ?? null,
      created_by: userId,
      // M8.14-R1: Provenance + lifecycle
      data_source: 'manual',
      status: 'draft',
    },
    include: {
      Site: { select: { id: true, name: true, code: true } },
      system: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json({ data: asset }, { status: 201 });
}
