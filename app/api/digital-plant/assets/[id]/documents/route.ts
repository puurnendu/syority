import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { AssetSearchService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const asset = await AssetSearchService.getAssetWithDocuments(orgId, id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(asset);
}
