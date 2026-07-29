import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { AssetSearchService } from '@/core/digital-plant';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || searchParams.get('query') || '';

  const result = await AssetSearchService.searchAssets({
    organizationId: orgId,
    query,
    assetType: searchParams.get('asset_type') ?? undefined,
    siteId: searchParams.get('site_id') ?? undefined,
    plantId: searchParams.get('plant_id') ?? undefined,
    unitId: searchParams.get('unit_id') ?? undefined,
    systemId: searchParams.get('system_id') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '25', 10),
  });

  return NextResponse.json(result);
}
