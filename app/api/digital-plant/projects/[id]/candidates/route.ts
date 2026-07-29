import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ExtractionService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;

  const { searchParams } = new URL(req.url);
  const result = await ExtractionService.listCandidates({
    organizationId: orgId,
    projectId,
    status: searchParams.get('status') ?? undefined,
    candidateType: searchParams.get('candidate_type') ?? undefined,
    documentId: searchParams.get('document_id') ?? undefined,
    minConfidence: searchParams.get('min_confidence') ? parseFloat(searchParams.get('min_confidence')!) : undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '50', 10),
  });

  return NextResponse.json(result);
}
