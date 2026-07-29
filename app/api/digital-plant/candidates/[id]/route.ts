import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ExtractionService, ReviewService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const candidate = await ExtractionService.getCandidate(orgId, id);
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(candidate);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const body = await req.json();
  try {
    const result = await ReviewService.editCandidate({
      organizationId: orgId,
      candidateId: id,
      userId,
      corrections: body.corrections || {},
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Edit failed' }, { status: 400 });
  }
}
