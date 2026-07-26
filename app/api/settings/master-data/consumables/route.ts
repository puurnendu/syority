import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

/** Legacy consumables API — now backed by item_catalog. Category filter: Gasket, Bolt, Blind, or omit for all. */
export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const user = session!.user as { organization_id?: string };
  const orgId = user.organization_id;
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 401 });

  try {
    const categoryParam = req.nextUrl.searchParams.get('category') || undefined;
    const itemCategory = categoryParam
      ? (categoryParam === 'Gasket' ? 'gasket' : categoryParam === 'Bolt' ? 'bolt' : categoryParam === 'Blind' ? 'blind' : 'consumable')
      : undefined;

    const where: { organization_id: string; deleted_at: null; item_category?: string } = {
      organization_id: orgId,
      deleted_at: null,
    };
    if (itemCategory) where.item_category = itemCategory;

    const items = await prisma.itemCatalog.findMany({
      where,
      orderBy: { description: 'asc' },
    });

    return NextResponse.json(
      items.map((row) => ({
        id: row.id,
        organization_id: row.organization_id,
        category: row.item_category,
        sub_category: row.sub_category,
        name: row.description,
        material_number: row.item_code,
        manufacturer: row.manufacturer,
        manufacturer_part_number: row.manufacturer_part_no,
        unit_of_measure: row.unit_of_measure,
        specifications: row.specification,
        reference_unit_cost: row.unit_cost,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }))
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const user = session!.user as { id?: string; organization_id?: string };
  const orgId = user.organization_id;
  const userId = user.id;
  if (!orgId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const itemCode =
      (body.material_number && String(body.material_number).trim()) ||
      `LEG-${Date.now().toString(36).toUpperCase()}`;
    const item = await prisma.itemCatalog.create({
      data: {
        organization_id: orgId,
        item_code: itemCode.slice(0, 50),
        description: String(body.name ?? '').trim(),
        item_category: body.category ? String(body.category).toLowerCase() : 'consumable',
        sub_category: body.sub_category ?? null,
        unit_of_measure: body.unit_of_measure ?? 'EA',
        specification: body.specifications ?? null,
        manufacturer: body.manufacturer ?? null,
        manufacturer_part_no: body.manufacturer_part_number ?? null,
        unit_cost: body.reference_unit_cost != null ? Number(body.reference_unit_cost) : null,
        is_active: body.is_active ?? true,
      },
    });
    await AuditService.log({
      organization_id: orgId,
      user_id: userId,
      action: 'created',
      model_name: 'ItemCatalog',
      model_id: item.id,
      new_values: item as Record<string, unknown>,
    });
    return NextResponse.json({
      id: item.id,
      organization_id: item.organization_id,
      category: item.item_category,
      sub_category: item.sub_category,
      name: item.description,
      material_number: item.item_code,
      manufacturer: item.manufacturer,
      manufacturer_part_number: item.manufacturer_part_no,
      unit_of_measure: item.unit_of_measure,
      specifications: item.specification,
      reference_unit_cost: item.unit_cost,
      is_active: item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const user = session!.user as { id?: string; organization_id?: string };
  const orgId = user.organization_id;
  const userId = user.id;
  if (!orgId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const id = body.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.itemCatalog.findFirst({
      where: { id, organization_id: orgId, deleted_at: null },
    });
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const updated = await prisma.itemCatalog.update({
      where: { id },
      data: {
        description: body.name !== undefined ? String(body.name).trim() : undefined,
        item_category: body.category !== undefined ? String(body.category).toLowerCase() : undefined,
        sub_category: body.sub_category !== undefined ? body.sub_category : undefined,
        unit_of_measure: body.unit_of_measure,
        specification: body.specifications !== undefined ? body.specifications : undefined,
        manufacturer: body.manufacturer !== undefined ? body.manufacturer : undefined,
        manufacturer_part_no: body.manufacturer_part_number !== undefined ? body.manufacturer_part_number : undefined,
        unit_cost: body.reference_unit_cost !== undefined ? (body.reference_unit_cost == null ? null : Number(body.reference_unit_cost)) : undefined,
        is_active: body.is_active !== undefined ? body.is_active : undefined,
      },
    });
    await AuditService.log({
      organization_id: orgId,
      user_id: userId,
      action: 'updated',
      model_name: 'ItemCatalog',
      model_id: id,
      old_values: existing as Record<string, unknown>,
      new_values: updated as Record<string, unknown>,
    });
    return NextResponse.json({
      id: updated.id,
      organization_id: updated.organization_id,
      category: updated.item_category,
      sub_category: updated.sub_category,
      name: updated.description,
      material_number: updated.item_code,
      manufacturer: updated.manufacturer,
      manufacturer_part_number: updated.manufacturer_part_no,
      unit_of_measure: updated.unit_of_measure,
      specifications: updated.specification,
      reference_unit_cost: updated.unit_cost,
      is_active: updated.is_active,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
