import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ExtractionService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id: documentId } = await params;

  const body = await req.json().catch(() => ({}));
  const projectId = body.project_id;
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });

  try {
    const result = await ExtractionService.extractFromDocument(orgId, projectId, documentId, userId);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Extraction failed' }, { status: 500 });
  }
}
