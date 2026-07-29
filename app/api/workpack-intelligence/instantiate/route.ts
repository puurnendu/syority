import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { WorkpackIntelligenceService } from '@/core/workpack-intelligence';

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.create');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const body = await req.json();

  if (!body.scope_item_id) return NextResponse.json({ error: 'scope_item_id is required' }, { status: 400 });
  if (!body.template_id) return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
  if (!body.site_id) return NextResponse.json({ error: 'site_id is required' }, { status: 400 });

  try {
    const result = await WorkpackIntelligenceService.instantiateFromScope({
      organizationId: orgId,
      siteId: body.site_id,
      scopeItemId: body.scope_item_id,
      templateId: body.template_id,
      userId,
      title: body.title,
      plannedStartDate: body.planned_start_date ? new Date(body.planned_start_date) : undefined,
      plannedEndDate: body.planned_end_date ? new Date(body.planned_end_date) : undefined,
      contractorId: body.contractor_id,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
