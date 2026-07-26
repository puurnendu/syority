import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { itemId } = await context.params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const existing = await prisma.itemCatalog.findFirst({
    where: { id: itemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.itemCatalog.update({
    where: { id: itemId },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      ...(body.long_description !== undefined && { long_description: body.long_description }),
      ...(body.item_category !== undefined && { item_category: body.item_category }),
      ...(body.unit_of_measure !== undefined && { unit_of_measure: body.unit_of_measure }),
      ...(body.sap_material_number !== undefined && { sap_material_number: body.sap_material_number }),
      ...(body.manufacturer !== undefined && { manufacturer: body.manufacturer }),
      ...(body.manufacturer_part_no !== undefined && { manufacturer_part_no: body.manufacturer_part_no }),
      ...(body.specification !== undefined && { specification: body.specification }),
      ...(body.pipe_size !== undefined && { pipe_size: body.pipe_size }),
      ...(body.pressure_rating !== undefined && { pressure_rating: body.pressure_rating }),
      ...(body.flange_type !== undefined && { flange_type: body.flange_type }),
      ...(body.unit_cost !== undefined && { unit_cost: body.unit_cost != null ? parseFloat(body.unit_cost) : null }),
      ...(body.is_active !== undefined && { is_active: body.is_active }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.sap_sync_status !== undefined && { sap_sync_status: body.sap_sync_status }),
      ...(body.sap_code !== undefined && { sap_code: body.sap_code }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { itemId } = await context.params;

  await prisma.itemCatalog.updateMany({
    where: { id: itemId, organization_id: orgId },
    data: { deleted_at: new Date(), is_active: false },
  });
  return NextResponse.json({ success: true });
}
