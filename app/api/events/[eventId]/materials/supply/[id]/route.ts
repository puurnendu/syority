/**
 * M8.12 — Supply Record Detail API
 * PATCH  /api/events/[eventId]/materials/supply/[id] — Update supply record
 * DELETE /api/events/[eventId]/materials/supply/[id] — Delete supply record
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { MaterialConstraintService } from '@/core/materials/MaterialConstraintService';

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id } = await params;
  const orgId = session.user.organization_id;

  try {
    const body = await req.json();
    const data = await MaterialConstraintService.updateSupplyRecord(id, orgId, body);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[PATCH /materials/supply/[id]] Error:', err);
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { id } = await params;
  const orgId = session.user.organization_id;

  try {
    await MaterialConstraintService.deleteSupplyRecord(id, orgId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /materials/supply/[id]] Error:', err);
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
});
