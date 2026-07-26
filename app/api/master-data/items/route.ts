import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const category = url.searchParams.get('category');
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const skip = (page - 1) * limit;

  const isDrafts = category === '_drafts';
  const statusFilter = url.searchParams.get('status');

  const where: Record<string, unknown> = {
    organization_id: orgId,
    is_active: isDrafts ? false : true,
    deleted_at: null,
  };

  if (statusFilter) (where as any).status = statusFilter;
  if (category && !isDrafts) (where as any).item_category = category;
  if (search) {
    (where as any).OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { item_code: { contains: search, mode: 'insensitive' } },
      { sap_material_number: { contains: search, mode: 'insensitive' } },
      { manufacturer_part_no: { contains: search, mode: 'insensitive' } },
      { specification: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.itemCatalog.findMany({
      where,
      orderBy: [{ item_category: 'asc' }, { item_code: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.itemCatalog.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = await req.json().catch(() => null);
  if (!body?.description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }
  if (!body?.item_code?.trim()) {
    return NextResponse.json({ error: 'Item code is required' }, { status: 400 });
  }

  const itemCode = String(body.item_code).trim().toUpperCase();

  const existing = await prisma.itemCatalog.findFirst({
    where: {
      organization_id: orgId,
      item_code: itemCode,
      deleted_at: null,
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Item code "${body.item_code}" already exists` },
      { status: 409 }
    );
  }

  const item = await prisma.itemCatalog.create({
    data: {
      organization_id: orgId,
      item_code: itemCode,
      description: String(body.description).trim(),
      long_description: body.long_description?.trim() ?? null,
      item_category: body.item_category ?? 'other',
      sub_category: body.sub_category ?? null,
      unit_of_measure: body.unit_of_measure ?? 'EA',
      sap_material_number: body.sap_material_number?.trim() ?? null,
      sap_plant: body.sap_plant?.trim() ?? null,
      sap_storage_location: body.sap_storage_location?.trim() ?? null,
      sap_material_group: body.sap_material_group?.trim() ?? null,
      manufacturer: body.manufacturer?.trim() ?? null,
      manufacturer_part_no: body.manufacturer_part_no?.trim() ?? null,
      specification: body.specification?.trim() ?? null,
      standard_reference: body.standard_reference?.trim() ?? null,
      material_grade: body.material_grade?.trim() ?? null,
      pipe_size: body.pipe_size ?? null,
      pressure_rating: body.pressure_rating ?? null,
      flange_type: body.flange_type ?? null,
      bolt_nominal_size: body.bolt_nominal_size ?? null,
      bolt_length_mm: body.bolt_length_mm != null ? parseInt(body.bolt_length_mm, 10) : null,
      unit_cost: body.unit_cost != null ? parseFloat(body.unit_cost) : null,
      currency: body.currency ?? 'USD',
    },
  });

  return NextResponse.json(item, { status: 201 });
}
