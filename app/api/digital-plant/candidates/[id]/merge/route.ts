import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ReviewService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json();
  if (!body.existing_asset_id) return NextResponse.json({ error: 'existing_asset_id is required' }, { status: 400 });

  try {
    const result = await ReviewService.mergeCandidate({
      organizationId: orgId,
      candidateId: id,
      existingAssetId: body.existing_asset_id,
      userId,
      fieldsToMerge: body.fields_to_merge,
      reviewNotes: body.review_notes,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Merge failed' }, { status: 400 });
  }
}
