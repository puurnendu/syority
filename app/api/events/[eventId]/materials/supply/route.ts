/**
 * M8.12 — Material Supply Records API
 * GET  /api/events/[eventId]/materials/supply — List supply records
 * POST /api/events/[eventId]/materials/supply — Create supply record
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { MaterialConstraintService } from '@/core/materials/MaterialConstraintService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const data = await MaterialConstraintService.listSupplyRecords(eventId, orgId);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /materials/supply] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const data = await MaterialConstraintService.createSupplyRecord({
      organization_id: orgId,
      material_line_id: body.material_line_id,
      supplier_name: body.supplier_name,
      po_number: body.po_number,
      po_line_number: body.po_line_number,
      quantity_ordered: body.quantity_ordered,
      quantity_received: body.quantity_received,
      expected_delivery: body.expected_delivery,
      delivery_status: body.delivery_status,
      unit_cost: body.unit_cost,
      notes: body.notes,
      created_by: session.user.id,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /materials/supply] Error:', err);
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});
