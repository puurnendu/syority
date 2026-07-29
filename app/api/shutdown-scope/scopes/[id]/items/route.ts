import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopeItemService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const result = await ScopeItemService.listItems({
    organizationId: orgId,
    scopeId: id,
    discipline: searchParams.get('discipline') ?? undefined,
    priority: searchParams.get('priority') ?? undefined,
    unitId: searchParams.get('unit_id') ?? undefined,
    systemId: searchParams.get('system_id') ?? undefined,
    packageId: searchParams.get('package_id') ?? undefined,
    isDeferred: searchParams.get('is_deferred') === 'true' ? true : searchParams.get('is_deferred') === 'false' ? false : undefined,
    isAdditional: searchParams.get('is_additional') === 'true' ? true : undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '50', 10),
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.asset_id || !body.reason) {
    return NextResponse.json({ error: 'asset_id and reason are required' }, { status: 400 });
  }

  const item = await ScopeItemService.addItem({
    organizationId: orgId,
    scopeId: id,
    assetId: body.asset_id,
    reason: body.reason,
    discipline: body.discipline,
    priority: body.priority,
    complexity: body.complexity,
    requestedBy: body.requested_by,
    estimatedHours: body.estimated_hours,
    templateId: body.template_id,
    templateName: body.template_name,
    plannerNotes: body.planner_notes,
    issueIds: body.issue_ids,
    isAdditional: body.is_additional,
    additionalType: body.additional_type,
    userId,
  });
  return NextResponse.json(item, { status: 201 });
}
