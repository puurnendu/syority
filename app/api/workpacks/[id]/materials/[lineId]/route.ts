import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id, lineId } = await context.params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (body.description !== undefined) updateData.description = body.description;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.linked_to !== undefined) updateData.linked_to = body.linked_to;
  if (body.item_code !== undefined) updateData.item_code = body.item_code;
  if (body.specification !== undefined) updateData.specification = body.specification;
  if (body.quantity_required !== undefined) {
    updateData.quantity_required = parseFloat(body.quantity_required);
    if (body.unit_cost != null) {
      updateData.total_cost =
        parseFloat(body.unit_cost) * parseFloat(body.quantity_required);
    }
  }
  if (body.quantity_issued !== undefined)
    updateData.quantity_issued = parseFloat(body.quantity_issued);
  if (body.quantity_used !== undefined)
    updateData.quantity_used = parseFloat(body.quantity_used);
  if (body.quantity_returned !== undefined)
    updateData.quantity_returned = parseFloat(body.quantity_returned);
  if (body.procurement_status !== undefined)
    updateData.procurement_status = body.procurement_status;
  if (body.is_critical !== undefined) updateData.is_critical = body.is_critical;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.unit_cost !== undefined)
    updateData.unit_cost =
      body.unit_cost != null ? parseFloat(body.unit_cost) : null;
  if (body.customName !== undefined) updateData.customName = body.customName;
  if (body.custom_name !== undefined) updateData.customName = body.custom_name;
  if (body.material_category !== undefined) updateData.material_category = body.material_category;
  if (body.discipline !== undefined) updateData.material_category = body.discipline;
  if (body.includedInPdf !== undefined) updateData.includedInPdf = body.includedInPdf;
  if (body.included_in_pdf !== undefined) updateData.includedInPdf = body.included_in_pdf;
  if (body.plannerNotes !== undefined) updateData.plannerNotes = body.plannerNotes;
  if (body.planner_notes !== undefined) updateData.plannerNotes = body.planner_notes;
  if (body.unit_of_measure !== undefined) updateData.unit_of_measure = body.unit_of_measure;

  const count = await prisma.workpack_material_lines.updateMany({
    where: {
      id: lineId,
      workpack_id: id,
      organization_id: orgId,
      deleted_at: null,
    },
    data: updateData,
  });

  if (count.count === 0)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id, lineId } = await context.params;

  const count = await prisma.workpack_material_lines.updateMany({
    where: {
      id: lineId,
      workpack_id: id,
      organization_id: orgId,
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });

  if (count.count === 0)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
