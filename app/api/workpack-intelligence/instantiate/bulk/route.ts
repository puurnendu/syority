import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackIntelligenceService } from '@/core/workpack-intelligence';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.create');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const body = await req.json();

  if (!body.site_id) return NextResponse.json({ error: 'site_id is required' }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 });
  }

  const result = await WorkpackIntelligenceService.bulkInstantiate({
    organizationId: orgId,
    siteId: body.site_id,
    items: body.items,
    userId,
  });

  return NextResponse.json({ data: result }, { status: 201 });
}
