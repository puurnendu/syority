import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.create');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const user = session!.user as any;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const siteId = body.site_id || user.site_id;
  if (!siteId) {
    return NextResponse.json({ error: 'site_id is required' }, { status: 400 });
  }

  try {
    const result = await TemplateLibraryService.instantiate({
      templateId: id,
      organizationId: orgId,
      siteId,
      userId: user.id,
      title: body.title,
      event_id: body.event_id,
      project_id: body.project_id,
      asset_id: body.asset_id,
      unit_id: body.unit_id,
      discipline_id: body.discipline_id,
      contractor_id: body.contractor_id,
      planned_start_date: body.planned_start_date
        ? new Date(body.planned_start_date)
        : undefined,
      planned_end_date: body.planned_end_date ? new Date(body.planned_end_date) : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Instantiate failed' },
      { status: 400 }
    );
  }
}
