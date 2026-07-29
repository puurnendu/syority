import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { IssueSearchService } from '@/core/engineering-issues';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const result = await IssueSearchService.search({
    organizationId: orgId,
    query: searchParams.get('q') ?? undefined,
    department: searchParams.get('department') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    priority: searchParams.get('priority') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    equipmentTag: searchParams.get('equipment_tag') ?? undefined,
    assetId: searchParams.get('asset_id') ?? undefined,
    unitId: searchParams.get('unit_id') ?? undefined,
    systemId: searchParams.get('system_id') ?? undefined,
    failureMode: searchParams.get('failure_mode') ?? undefined,
    batchId: searchParams.get('batch_id') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '50', 10),
  });

  return NextResponse.json(result);
}
